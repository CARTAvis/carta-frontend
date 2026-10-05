import {CARTA} from "carta-protobuf";

jest.mock("stores", () => ({AppStore: {DEFAULT_STATS_TYPES: [CARTA.StatsType.NumPixels, CARTA.StatsType.Mean, CARTA.StatsType.Sum]}}));
jest.mock("stores/Widgets", () => ({RegionWidgetStore: class {}}));
jest.mock("models", () => ({VALID_COORDINATES: ["z"]}));
jest.mock("enums", () => ({Polarizations: {}, RegionsType: {CLOSED: 0}}));

import {StatsWidgetStore} from "./StatsWidgetStore";

const MakeWidget = (annulusMode: "annulus" | "inner" | "compare", fileId = 0): StatsWidgetStore =>
    Object.assign(Object.create(StatsWidgetStore.prototype), {
        effectiveFrame: {frameInfo: {fileId}, regionSet: {}},
        effectiveRegion: {
            isClosedRegion: true,
            regionType: CARTA.RegionType.ANNULUS,
            statsArea: annulusMode === "inner" ? "inner" : "annulus",
            statsBackground: annulusMode === "compare" ? "inner" : "none",
            annulusStatsRegionIds: {annulus: 51, inner: 52}
        },
        effectiveRegionId: 1,
        coordinate: "z"
    });

const Requirements = (...widgets: StatsWidgetStore[]) => StatsWidgetStore.calculateRequirementsMap(new Map(widgets.map((widget, index) => [String(index), widget])));

describe("annulus statistics requirements", () => {
    test("uses ordinary region requests for the selected area", () => {
        expect([...Requirements(MakeWidget("annulus")).get(0)!.keys()]).toEqual([1]);
        expect([...Requirements(MakeWidget("inner")).get(0)!.keys()]).toEqual([52]);
        expect([...Requirements(MakeWidget("compare")).get(0)!.keys()]).toEqual([51, 52]);
        expect(Requirements(MakeWidget("compare")).get(0)?.get(52)?.statsConfigs[0]).toEqual({coordinate: "z", statsTypes: [CARTA.StatsType.NumPixels, CARTA.StatsType.Mean, CARTA.StatsType.Sum]});
    });

    test("requests the selected background and deduplicates matching areas", () => {
        const widget = MakeWidget("inner");
        Object.assign(widget.effectiveRegion!, {statsBackground: "annulus"});
        expect([...Requirements(widget).get(0)!.keys()]).toEqual([52, 51]);
        Object.assign(widget.effectiveRegion!, {statsBackground: "inner"});
        expect([...Requirements(widget).get(0)!.keys()]).toEqual([52]);
    });

    test("shares the inner request across widgets and uses the matched image's file ID", () => {
        const requirements = Requirements(MakeWidget("compare", 4), MakeWidget("inner", 4));
        expect(requirements.has(0)).toBe(false);
        expect(requirements.get(4)?.get(52)?.statsConfigs).toHaveLength(1);
    });

    test("waits until the current geometry's analysis regions exist", () => {
        const widget = MakeWidget("compare");
        Object.assign(widget.effectiveRegion!, {annulusStatsRegionIds: null});
        expect(Requirements(widget).size).toBe(0);
        expect(widget.statsRegionId).toBeNull();
    });

    test("clears old subscriptions when switching between annulus and comparison", () => {
        const normal = Requirements(MakeWidget("annulus"));
        const comparison = Requirements(MakeWidget("compare"));
        const forward = StatsWidgetStore.diffStatsRequirements(normal, comparison);
        expect(forward[0].regionId).toBe(1);
        expect(forward[0].statsConfigs).toHaveLength(0);
        expect(
            forward
                .slice(1)
                .map(requirement => requirement.regionId)
                .sort((a, b) => a - b)
        ).toEqual([51, 52]);
        const backward = StatsWidgetStore.diffStatsRequirements(comparison, Requirements(MakeWidget("annulus")));
        expect(
            backward
                .filter(requirement => !requirement.statsConfigs.length)
                .map(requirement => requirement.regionId)
                .sort((a, b) => a - b)
        ).toEqual([51, 52]);
        expect(backward.find(requirement => requirement.statsConfigs.length)?.regionId).toBe(1);
    });
});
