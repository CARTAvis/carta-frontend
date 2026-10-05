import * as React from "react";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {CARTA} from "carta-protobuf";
import {makeAutoObservable, runInAction} from "mobx";

const APP_STORE_MOCK = {
    regionStats: new Map(),
    isDarkTheme: false,
    widgetsStore: {statsWidgets: new Map(), setWidgetTitle: jest.fn()}
};

jest.mock("stores", () => ({AppStore: {Instance: APP_STORE_MOCK}}));
jest.mock("stores/Widgets", () => ({StatsWidgetStore: class {}}));
jest.mock("components/Shared", () => ({
    ResizeDetector: ({children}: {children: React.ReactNode}) => children,
    RegionSelectorComponent: () => null
}));
jest.mock("components/Shared/LinePlot/Toolbar/ToolbarComponent", () => ({
    ToolbarComponent: ({exportData}: {exportData: () => void}) => <button onClick={exportData}>Export</button>
}));
jest.mock("enums", () => ({HelpType: {STATS: 0}, Polarizations: {PFtotal: 13, PFlinear: 14, Pangle: 15}}));
jest.mock("models", () => ({FULL_POLARIZATIONS: new Map()}));
jest.mock("utilities", () => ({
    exportTsvFile: jest.fn(),
    getAnnulusSignalToNoise: jest.requireActual("utilities/region/annulusStatistics").getAnnulusSignalToNoise,
    pixelToFluxDensityUnit: () => "Jy",
    toExponential: (value: number) => String(value)
}));

import {exportTsvFile} from "utilities";

import {StatsComponent} from "./StatsComponent";

describe("annulus statistics widget", () => {
    beforeEach(() => {
        const frame = {
            frameInfo: {fileId: 0, fileInfoExtended: {stokes: 1}},
            filename: "image.fits",
            requiredChannel: 0,
            requiredStokes: 0,
            polarizationInfo: ["Stokes I"],
            polarizations: [0],
            coordinateOptionsZ: [],
            headerUnit: "Jy/beam",
            getRegionProperties: () => ["Annulus"],
            regionSet: {regions: [{regionId: 1, nameString: "Region 1"}]}
        };
        const widget = makeAutoObservable({
            effectiveFrame: frame,
            effectiveRegionId: 1,
            isAnnulus: true,
            effectiveRegion: {statsArea: "inner", statsBackground: "none"},
            coordinate: "z",
            get shouldUseAnalysisRegions() {
                return this.effectiveRegion.statsArea === "inner" || this.hasBackground;
            },
            get statsRegionId() {
                return this.effectiveRegion.statsArea === "inner" ? 52 : this.hasBackground ? 51 : 1;
            },
            get backgroundStatsRegionId() {
                return this.hasBackground ? (this.effectiveRegion.statsBackground === "inner" ? 52 : 51) : null;
            },
            get hasBackground() {
                return this.effectiveRegion.statsBackground !== "none";
            },
            setCoordinate(coordinate: string) {
                this.coordinate = coordinate;
            }
        });
        APP_STORE_MOCK.widgetsStore.statsWidgets = new Map([["stats-test", widget]]);
        const annulus = new CARTA.RegionStatsData({
            channel: 0,
            stokes: 0,
            statistics: [
                {statsType: CARTA.StatsType.NumPixels, value: 10},
                {statsType: CARTA.StatsType.Sum, value: 30},
                {statsType: CARTA.StatsType.Mean, value: 3}
            ]
        });
        const inner = new CARTA.RegionStatsData({
            channel: 0,
            stokes: 0,
            statistics: [
                {statsType: CARTA.StatsType.NumPixels, value: 4},
                {statsType: CARTA.StatsType.Sum, value: 32},
                {statsType: CARTA.StatsType.Mean, value: 8}
            ]
        });
        APP_STORE_MOCK.regionStats = new Map([
            [
                0,
                new Map([
                    [1, new Map([[0, annulus]])],
                    [51, new Map([[0, annulus]])],
                    [52, new Map([[0, inner]])]
                ])
            ]
        ]);
    });

    test("uses region settings, omits the area dropdown, and exports unitless S/N", () => {
        render(<StatsComponent id="stats-test" docked={true} />);
        expect(screen.queryByTestId("annulus-area-dropdown")).not.toBeInTheDocument();
        expect(screen.getByText("8 Jy/beam")).toBeInTheDocument();
        expect(screen.queryByText("S/N")).not.toBeInTheDocument();
        act(() =>
            runInAction(() => {
                APP_STORE_MOCK.widgetsStore.statsWidgets.get("stats-test").effectiveRegion.statsBackground = "annulus";
            })
        );
        expect(screen.getByText("S/N")).toBeInTheDocument();
        expect(screen.getByText(String(5 / 3))).toBeInTheDocument();
        fireEvent.click(screen.getByText("Export"));
        expect(exportTsvFile).toHaveBeenCalledWith("image.fits", "statistics", expect.stringContaining(`S/N\t${5 / 3}\tN/A`));
        act(() =>
            runInAction(() => {
                APP_STORE_MOCK.widgetsStore.statsWidgets.get("stats-test").effectiveRegion.statsBackground = "none";
            })
        );
        expect(screen.queryByText("S/N")).not.toBeInTheDocument();
    });

    test("displays and exports an undefined S/N for a zero background mean", () => {
        const background = APP_STORE_MOCK.regionStats.get(0).get(51).get(0);
        background.statistics.find(statistic => statistic.statsType === CARTA.StatsType.Mean).value = 0;
        APP_STORE_MOCK.widgetsStore.statsWidgets.get("stats-test").effectiveRegion.statsBackground = "annulus";
        render(<StatsComponent id="stats-test" docked={true} />);
        expect(screen.getByText("S/N")).toBeInTheDocument();
        expect(screen.getByText("NaN")).toBeInTheDocument();
        fireEvent.click(screen.getByText("Export"));
        expect(exportTsvFile).toHaveBeenLastCalledWith("image.fits", "statistics", expect.stringContaining("S/N\tNaN\tN/A"));
    });

    test("waits for the selected background statistics", async () => {
        APP_STORE_MOCK.regionStats.get(0).delete(51);
        APP_STORE_MOCK.widgetsStore.statsWidgets.get("stats-test").effectiveRegion.statsBackground = "annulus";
        await act(async () => {
            render(<StatsComponent id="stats-test" docked={true} />);
        });
        expect(screen.queryByTestId("statistics-table")).not.toBeInTheDocument();
    });

    test("does not display paired statistics from a different channel", async () => {
        APP_STORE_MOCK.widgetsStore.statsWidgets.get("stats-test").effectiveFrame.requiredChannel = 1;
        await act(async () => {
            render(<StatsComponent id="stats-test" docked={true} />);
        });
        expect(screen.queryByTestId("statistics-table")).not.toBeInTheDocument();
    });
});
