jest.mock("components/Shared", () => ({
    ClearableNumericInputComponent: jest.fn(),
    SafeNumericInput: jest.fn(),
    ScrollShadow: jest.fn()
}));
jest.mock("services", () => ({CatalogApiService: {Instance: {benchmarkMirror: jest.fn()}}}));

const MOCK_CONFIG_STORE = {catalogDB: "SIMBAD"};
const MOCK_PREFERENCE_STORE = {
    catalogQuerySimbadMirrors: [] as string[],
    catalogQueryVizierMirrors: [] as string[],
    setPreference: jest.fn()
};

jest.mock("stores", () => ({
    AppStore: {Instance: {}},
    CatalogOnlineQueryConfigStore: {Instance: MOCK_CONFIG_STORE},
    PreferenceStore: {Instance: MOCK_PREFERENCE_STORE}
}));
jest.mock("utilities", () => ({
    NUMBER_FORMAT_LABEL: new Map(),
    clamp: jest.fn(),
    getFormattedWCSPoint: jest.fn(),
    getPixelValueFromWCS: jest.fn(),
    isWCSStringFormatValid: jest.fn()
}));

import {CatalogDatabase, PreferenceKeys} from "enums";

import {CatalogQueryComponent} from "./CatalogOnlineQueryComponent";

type MirrorBenchmark = {status: "idle" | "pending" | "ok" | "fail"; ms?: number};

interface TestableCatalogQueryComponent {
    isBenchmarking: boolean;
    mirrorBenchmarks: Map<string, MirrorBenchmark>;
    mirrorBenchmarkAbort?: {abort: () => void};
    cancelMirrorBenchmark: () => void;
}

describe("CatalogQueryComponent mirror benchmark cancellation", () => {
    beforeEach(() => {
        MOCK_CONFIG_STORE.catalogDB = CatalogDatabase.SIMBAD;
        MOCK_PREFERENCE_STORE.catalogQuerySimbadMirrors = ["slow", "not-tested", "fast"];
        MOCK_PREFERENCE_STORE.catalogQueryVizierMirrors = [];
        MOCK_PREFERENCE_STORE.setPreference.mockImplementation((_key: string, sites: string[]) => {
            MOCK_PREFERENCE_STORE.catalogQuerySimbadMirrors = sites;
        });
    });

    test("sorts completed benchmark results when the run is cancelled", () => {
        const component = new CatalogQueryComponent({}) as unknown as TestableCatalogQueryComponent;
        const abort = jest.fn();
        component.isBenchmarking = true;
        component.mirrorBenchmarkAbort = {abort};
        component.mirrorBenchmarks = new Map([
            ["slow", {status: "ok", ms: 200}],
            ["not-tested", {status: "pending"}],
            ["fast", {status: "ok", ms: 50}]
        ]);

        component.cancelMirrorBenchmark();

        expect(abort).toHaveBeenCalledTimes(1);
        expect(component.isBenchmarking).toBe(false);
        expect(MOCK_PREFERENCE_STORE.setPreference).toHaveBeenCalledWith(PreferenceKeys.CATALOG_QUERY_SIMBAD_MIRRORS, ["fast", "slow", "not-tested"]);
        expect(component.mirrorBenchmarks.get("not-tested")).toEqual({status: "idle"});
    });
});
