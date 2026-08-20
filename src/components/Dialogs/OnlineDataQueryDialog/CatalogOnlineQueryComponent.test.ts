import type {CSSProperties} from "react";
import {autorun, runInAction} from "mobx";

jest.mock("components/Shared", () => ({
    AppToaster: {show: jest.fn()},
    ClearableNumericInputComponent: jest.fn(),
    ErrorToast: jest.fn((message: string) => ({message})),
    SafeNumericInput: jest.fn(),
    ScrollShadow: jest.fn()
}));
jest.mock("services", () => ({CatalogApiService: {Instance: {benchmarkMirror: jest.fn(), getSimbadCatalog: jest.fn()}}}));

const MOCK_CONFIG_STORE = {catalogDB: "SIMBAD", objectName: "M31", setCatalogDB: jest.fn(), setObjectQueryStatus: jest.fn()};
const MOCK_MIRROR_SITES: Partial<Record<CatalogDatabase, string[]>> = {};
const MOCK_ACTIVE_MIRRORS: Partial<Record<CatalogDatabase, string>> = {};
const MOCK_PREFERENCE_STORE = {
    getCatalogQueryMirrors: jest.fn((database: CatalogDatabase) => MOCK_MIRROR_SITES[database] ?? []),
    getCatalogQueryActiveMirror: jest.fn((database: CatalogDatabase) => MOCK_ACTIVE_MIRRORS[database]),
    isCatalogQueryMirrorDisabled: jest.fn((_site: string) => false),
    isCatalogQueryMirrorUserDisabled: jest.fn((_database: CatalogDatabase, _site: string) => false),
    setCatalogQueryActiveMirror: jest.fn((database: CatalogDatabase, mirror: string) => {
        MOCK_ACTIVE_MIRRORS[database] = mirror;
    }),
    setCatalogQueryEnabledMirrors: jest.fn((database: CatalogDatabase, mirrors: string[]) => {
        MOCK_MIRROR_SITES[database] = mirrors;
    }),
    toggleCatalogQueryMirrorDisabled: jest.fn(),
    resetCatalogQueryMirrorSettings: jest.fn()
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
import {CatalogDatabase} from "enums";
import {CatalogApiService} from "services";

import {CatalogQueryComponent} from "./CatalogOnlineQueryComponent";

type MirrorBenchmark = {status: "idle" | "pending" | "ok" | "fail" | "disabled"; ms?: number};

interface TestableCatalogQueryComponent {
    isBenchmarking: boolean;
    mirrorBenchmarks: Map<string, MirrorBenchmark>;
    mirrorBenchmarkAbort?: {abort: () => void};
    mirrorBenchmarkDatabase?: CatalogDatabase;
    cancelMirrorBenchmark: (sortByBenchmark?: boolean) => void;
    getMirrorBenchmarkDisplay: (benchmark?: MirrorBenchmark, isBlocked?: boolean, isUserDisabled?: boolean) => {label: string; status: string; resultStyle?: CSSProperties};
    getMirrorSites: (database: CatalogDatabase) => string[];
    getMirrorBenchmarkKey: (database: CatalogDatabase, site: string) => string;
    handleDatabaseSelect: (database: CatalogDatabase) => void;
    handleObjectUpdate: () => void;
    handleMirrorSelect: (database: CatalogDatabase, mirror: string) => void;
    handleMirrorToggle: (database: CatalogDatabase, mirror: string) => void;
    runMirrorBenchmark: () => Promise<void>;
}

describe("CatalogQueryComponent mirror benchmark cancellation", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        MOCK_CONFIG_STORE.catalogDB = CatalogDatabase.SIMBAD;
        MOCK_MIRROR_SITES[CatalogDatabase.SIMBAD] = ["slow", "not-tested", "fast"];
        MOCK_MIRROR_SITES[CatalogDatabase.VIZIER] = ["vizier-default"];
        delete MOCK_ACTIVE_MIRRORS[CatalogDatabase.SIMBAD];
        delete MOCK_ACTIVE_MIRRORS[CatalogDatabase.VIZIER];
        MOCK_PREFERENCE_STORE.isCatalogQueryMirrorDisabled.mockImplementation(() => false);
        MOCK_PREFERENCE_STORE.isCatalogQueryMirrorUserDisabled.mockImplementation(() => false);
    });

    test("does not reorder mirrors when cancellation occurs after a database change", () => {
        const component = new CatalogQueryComponent({}) as unknown as TestableCatalogQueryComponent;
        const abort = jest.fn();
        runInAction(() => {
            component.isBenchmarking = true;
            component.mirrorBenchmarkAbort = {abort};
            component.mirrorBenchmarkDatabase = CatalogDatabase.SIMBAD;
            component.mirrorBenchmarks = new Map([
                [component.getMirrorBenchmarkKey(CatalogDatabase.SIMBAD, "slow"), {status: "ok", ms: 200}],
                [component.getMirrorBenchmarkKey(CatalogDatabase.SIMBAD, "not-tested"), {status: "pending"}],
                [component.getMirrorBenchmarkKey(CatalogDatabase.SIMBAD, "fast"), {status: "ok", ms: 50}]
            ]);
        });
        MOCK_CONFIG_STORE.catalogDB = CatalogDatabase.VIZIER;

        component.cancelMirrorBenchmark();

        expect(abort).toHaveBeenCalledTimes(1);
        expect(component.isBenchmarking).toBe(false);
        expect(MOCK_MIRROR_SITES[CatalogDatabase.SIMBAD]).toEqual(["slow", "not-tested", "fast"]);
        expect(MOCK_MIRROR_SITES[CatalogDatabase.VIZIER]).toEqual(["vizier-default"]);
        expect(component.mirrorBenchmarks.get(component.getMirrorBenchmarkKey(CatalogDatabase.SIMBAD, "not-tested"))).toEqual({status: "idle"});
    });

    test("sorts completed benchmark results when speed testing is canceled", () => {
        const component = new CatalogQueryComponent({}) as unknown as TestableCatalogQueryComponent;
        const abort = jest.fn();
        MOCK_MIRROR_SITES[CatalogDatabase.SIMBAD] = ["slow", "fast"];
        runInAction(() => {
            component.isBenchmarking = true;
            component.mirrorBenchmarkAbort = {abort};
            component.mirrorBenchmarkDatabase = CatalogDatabase.SIMBAD;
            component.mirrorBenchmarks = new Map([
                [component.getMirrorBenchmarkKey(CatalogDatabase.SIMBAD, "slow"), {status: "pending"}],
                [component.getMirrorBenchmarkKey(CatalogDatabase.SIMBAD, "fast"), {status: "ok", ms: 50}]
            ]);
        });

        component.cancelMirrorBenchmark(true);

        expect(MOCK_PREFERENCE_STORE.setCatalogQueryEnabledMirrors).toHaveBeenCalledWith(CatalogDatabase.SIMBAD, ["fast", "slow"]);
        expect(component.mirrorBenchmarks.get(component.getMirrorBenchmarkKey(CatalogDatabase.SIMBAD, "slow"))).toEqual({status: "idle"});
    });

    test("ignores database changes while a mirror benchmark is running", () => {
        const component = new CatalogQueryComponent({}) as unknown as TestableCatalogQueryComponent;
        runInAction(() => {
            component.isBenchmarking = true;
        });

        component.handleDatabaseSelect(CatalogDatabase.VIZIER);
        expect(MOCK_CONFIG_STORE.setCatalogDB).not.toHaveBeenCalled();

        runInAction(() => {
            component.isBenchmarking = false;
        });
        component.handleDatabaseSelect(CatalogDatabase.VIZIER);
        expect(MOCK_CONFIG_STORE.setCatalogDB).toHaveBeenCalledWith(CatalogDatabase.VIZIER);
    });
});

describe("CatalogQueryComponent MobX actions", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        MOCK_CONFIG_STORE.catalogDB = CatalogDatabase.SIMBAD;
        MOCK_MIRROR_SITES[CatalogDatabase.SIMBAD] = ["slow", "fast"];
        MOCK_MIRROR_SITES[CatalogDatabase.VIZIER] = [];
        delete MOCK_ACTIVE_MIRRORS[CatalogDatabase.SIMBAD];
        delete MOCK_ACTIVE_MIRRORS[CatalogDatabase.VIZIER];
        MOCK_PREFERENCE_STORE.isCatalogQueryMirrorDisabled.mockImplementation(() => false);
        MOCK_PREFERENCE_STORE.isCatalogQueryMirrorUserDisabled.mockImplementation(() => false);
    });

    test("updates benchmark observables inside actions and sorts mirrors by response time", async () => {
        const component = new CatalogQueryComponent({}) as unknown as TestableCatalogQueryComponent;
        const consoleWarn = jest.spyOn(console, "warn").mockImplementation();
        const dispose = autorun(() => {
            void component.isBenchmarking;
            Array.from(component.mirrorBenchmarks.values());
        });
        (CatalogApiService.Instance.benchmarkMirror as jest.Mock).mockImplementation((_database, site) => Promise.resolve(site === "fast" ? 50 : 200));

        try {
            await component.runMirrorBenchmark();

            expect(component.isBenchmarking).toBe(false);
            expect(component.mirrorBenchmarks.get(component.getMirrorBenchmarkKey(CatalogDatabase.SIMBAD, "fast"))).toEqual({status: "ok", ms: 50});
            expect(component.mirrorBenchmarks.get(component.getMirrorBenchmarkKey(CatalogDatabase.SIMBAD, "slow"))).toEqual({status: "ok", ms: 200});
            expect(MOCK_PREFERENCE_STORE.setCatalogQueryEnabledMirrors).toHaveBeenCalledWith(CatalogDatabase.SIMBAD, ["fast", "slow"]);
            expect(MOCK_MIRROR_SITES[CatalogDatabase.SIMBAD]).toEqual(["fast", "slow"]);
            expect(consoleWarn).not.toHaveBeenCalled();
        } finally {
            dispose();
            consoleWarn.mockRestore();
        }
    });

    test("selects a mirror without changing the order", () => {
        const component = new CatalogQueryComponent({}) as unknown as TestableCatalogQueryComponent;

        component.handleMirrorSelect(CatalogDatabase.SIMBAD, "fast");

        expect(MOCK_PREFERENCE_STORE.setCatalogQueryActiveMirror).toHaveBeenCalledWith(CatalogDatabase.SIMBAD, "fast");
        expect(MOCK_PREFERENCE_STORE.setCatalogQueryEnabledMirrors).not.toHaveBeenCalled();
        expect(MOCK_MIRROR_SITES[CatalogDatabase.SIMBAD]).toEqual(["slow", "fast"]);
    });

    test("keeps disabled mirrors at the bottom in alphabetical order", () => {
        const component = new CatalogQueryComponent({}) as unknown as TestableCatalogQueryComponent;
        MOCK_MIRROR_SITES[CatalogDatabase.SIMBAD] = ["fast", "https://zulu.example/", "https://alpha.example/"];
        MOCK_PREFERENCE_STORE.isCatalogQueryMirrorUserDisabled.mockImplementation((_database: CatalogDatabase, site: string) => site !== "fast");

        expect(component.getMirrorSites(CatalogDatabase.SIMBAD)).toEqual(["fast", "https://alpha.example/", "https://zulu.example/"]);
    });

    test("shows an idle result after a previously disabled mirror is enabled", () => {
        const component = new CatalogQueryComponent({}) as unknown as TestableCatalogQueryComponent;

        expect(component.getMirrorBenchmarkDisplay({status: "disabled"}, false, false)).toEqual({label: "—", status: "idle"});
        expect(component.getMirrorBenchmarkDisplay({status: "disabled"}, false, true)).toEqual({label: "Disabled", status: "disabled"});
    });

    test("does not benchmark HTTP mirrors on secure pages", async () => {
        const component = new CatalogQueryComponent({}) as unknown as TestableCatalogQueryComponent;
        MOCK_MIRROR_SITES[CatalogDatabase.SIMBAD] = ["http://legacy.example/", "https://secure.example/"];
        MOCK_PREFERENCE_STORE.isCatalogQueryMirrorDisabled.mockImplementation((site: string) => site.startsWith("http://"));
        (CatalogApiService.Instance.benchmarkMirror as jest.Mock).mockResolvedValue(50);

        await component.runMirrorBenchmark();

        expect(CatalogApiService.Instance.benchmarkMirror).toHaveBeenCalledTimes(1);
        expect(CatalogApiService.Instance.benchmarkMirror).toHaveBeenCalledWith(CatalogDatabase.SIMBAD, "https://secure.example/", 10000, expect.anything());
        expect(component.mirrorBenchmarks.get(component.getMirrorBenchmarkKey(CatalogDatabase.SIMBAD, "http://legacy.example/"))).toEqual({status: "disabled"});
    });

    test("toggles a user-disabled mirror and keeps the last usable mirror enabled", () => {
        const component = new CatalogQueryComponent({}) as unknown as TestableCatalogQueryComponent;
        MOCK_PREFERENCE_STORE.isCatalogQueryMirrorDisabled.mockImplementation((site: string) => site.startsWith("http://"));
        MOCK_MIRROR_SITES[CatalogDatabase.SIMBAD] = ["https://secure.example/", "https://backup.example/", "http://legacy.example/"];

        component.handleMirrorToggle(CatalogDatabase.SIMBAD, "https://secure.example/");
        expect(MOCK_PREFERENCE_STORE.toggleCatalogQueryMirrorDisabled).toHaveBeenCalledWith(CatalogDatabase.SIMBAD, "https://secure.example/");

        MOCK_PREFERENCE_STORE.toggleCatalogQueryMirrorDisabled.mockClear();
        MOCK_MIRROR_SITES[CatalogDatabase.SIMBAD] = ["https://secure.example/", "http://legacy.example/"];
        component.handleMirrorToggle(CatalogDatabase.SIMBAD, "https://secure.example/");
        expect(MOCK_PREFERENCE_STORE.toggleCatalogQueryMirrorDisabled).not.toHaveBeenCalled();
    });

    test("moves an enabled mirror to the end of the enabled mirrors", () => {
        const component = new CatalogQueryComponent({}) as unknown as TestableCatalogQueryComponent;
        MOCK_MIRROR_SITES[CatalogDatabase.SIMBAD] = ["fast", "disabled", "backup"];
        MOCK_PREFERENCE_STORE.isCatalogQueryMirrorUserDisabled.mockImplementation((_database: CatalogDatabase, site: string) => site === "disabled");

        component.handleMirrorToggle(CatalogDatabase.SIMBAD, "disabled");

        expect(MOCK_PREFERENCE_STORE.toggleCatalogQueryMirrorDisabled).toHaveBeenCalledWith(CatalogDatabase.SIMBAD, "disabled");
        expect(MOCK_PREFERENCE_STORE.setCatalogQueryEnabledMirrors).toHaveBeenCalledWith(CatalogDatabase.SIMBAD, ["fast", "backup", "disabled"]);
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
