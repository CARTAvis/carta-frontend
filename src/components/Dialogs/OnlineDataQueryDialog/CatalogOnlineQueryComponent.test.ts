jest.mock("components/Shared", () => ({
    AppToaster: {show: jest.fn()},
    ClearableNumericInputComponent: jest.fn(),
    ErrorToast: jest.fn((message: string) => ({message})),
    SafeNumericInput: jest.fn(),
    ScrollShadow: jest.fn()
}));
jest.mock("services", () => ({CatalogApiService: {Instance: {benchmarkMirror: jest.fn(), getSimbadCatalog: jest.fn()}}}));

const MOCK_CONFIG_STORE = {catalogDB: "SIMBAD", objectName: "M31", setObjectQueryStatus: jest.fn()};
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

import {AppToaster, ErrorToast} from "components/Shared";
import {CatalogDatabase, PreferenceKeys} from "enums";
import {CatalogApiService} from "services";

import {CatalogQueryComponent} from "./CatalogOnlineQueryComponent";

type MirrorBenchmark = {status: "idle" | "pending" | "ok" | "fail"; ms?: number};

interface TestableCatalogQueryComponent {
    isBenchmarking: boolean;
    mirrorBenchmarks: Map<string, MirrorBenchmark>;
    mirrorBenchmarkAbort?: {abort: () => void};
    cancelMirrorBenchmark: () => void;
    handleObjectUpdate: () => void;
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

describe("CatalogQueryComponent object resolution error", () => {
    test("shows the actionable mirror error in a toast", async () => {
        const error = new Error("Request to mirror active.example failed. Select another mirror site and retry.");
        (CatalogApiService.Instance.getSimbadCatalog as jest.Mock).mockRejectedValueOnce(error);
        const component = new CatalogQueryComponent({}) as unknown as TestableCatalogQueryComponent;

        component.handleObjectUpdate();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(ErrorToast).toHaveBeenCalledWith(error.message);
        expect(AppToaster.show).toHaveBeenCalledWith({message: error.message});
        expect(MOCK_CONFIG_STORE.setObjectQueryStatus).toHaveBeenNthCalledWith(1, true);
        expect(MOCK_CONFIG_STORE.setObjectQueryStatus).toHaveBeenNthCalledWith(2, false);
    });
});
