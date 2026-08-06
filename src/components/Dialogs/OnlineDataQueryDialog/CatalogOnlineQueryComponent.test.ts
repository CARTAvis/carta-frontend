import type {DragEvent} from "react";
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
const MOCK_PREFERENCE_STORE = {
    getCatalogQueryMirrors: jest.fn((database: CatalogDatabase) => MOCK_MIRROR_SITES[database] ?? []),
    isCatalogQueryMirrorDisabled: jest.fn((_site: string) => false),
    setCatalogQueryMirrors: jest.fn()
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
    dragSourceMirrorIndex?: number;
    dragOverMirrorIndex?: number;
    isBenchmarking: boolean;
    mirrorBenchmarks: Map<string, MirrorBenchmark>;
    mirrorBenchmarkAbort?: {abort: () => void};
    mirrorBenchmarkDatabase?: CatalogDatabase;
    cancelMirrorBenchmark: () => void;
    handleDatabaseSelect: (database: CatalogDatabase) => void;
    handleMirrorDragStart: (index: number) => (event: DragEvent<HTMLDivElement>) => void;
    handleMirrorDragOver: (index: number) => (event: DragEvent<HTMLDivElement>) => void;
    handleMirrorDragEnd: () => void;
    handleObjectUpdate: () => void;
    isMirrorRemovalDisabled: (mirror: string, mirrorCount: number, testableMirrorCount: number, isMirrorConfigDisabled: boolean) => boolean;
    runMirrorBenchmark: () => Promise<void>;
}

describe("CatalogQueryComponent mirror benchmark cancellation", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        MOCK_CONFIG_STORE.catalogDB = CatalogDatabase.SIMBAD;
        MOCK_MIRROR_SITES[CatalogDatabase.SIMBAD] = ["slow", "not-tested", "fast"];
        MOCK_MIRROR_SITES[CatalogDatabase.VIZIER] = ["vizier-default"];
        MOCK_PREFERENCE_STORE.isCatalogQueryMirrorDisabled.mockImplementation(() => false);
        MOCK_PREFERENCE_STORE.setCatalogQueryMirrors.mockImplementation((database: CatalogDatabase, sites: string[]) => {
            MOCK_MIRROR_SITES[database] = sites;
        });
    });

    test("sorts completed results for the benchmarked database when selection changes before cancellation", () => {
        const component = new CatalogQueryComponent({}) as unknown as TestableCatalogQueryComponent;
        const abort = jest.fn();
        runInAction(() => {
            component.isBenchmarking = true;
            component.mirrorBenchmarkAbort = {abort};
            component.mirrorBenchmarkDatabase = CatalogDatabase.SIMBAD;
            component.mirrorBenchmarks = new Map([
                ["slow", {status: "ok", ms: 200}],
                ["not-tested", {status: "pending"}],
                ["fast", {status: "ok", ms: 50}]
            ]);
        });
        MOCK_CONFIG_STORE.catalogDB = CatalogDatabase.VIZIER;

        component.cancelMirrorBenchmark();

        expect(abort).toHaveBeenCalledTimes(1);
        expect(component.isBenchmarking).toBe(false);
        expect(MOCK_PREFERENCE_STORE.setCatalogQueryMirrors).toHaveBeenCalledWith(CatalogDatabase.SIMBAD, ["fast", "slow", "not-tested"]);
        expect(MOCK_MIRROR_SITES[CatalogDatabase.VIZIER]).toEqual(["vizier-default"]);
        expect(component.mirrorBenchmarks.get("not-tested")).toEqual({status: "idle"});
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
        MOCK_PREFERENCE_STORE.isCatalogQueryMirrorDisabled.mockImplementation(() => false);
        MOCK_PREFERENCE_STORE.setCatalogQueryMirrors.mockImplementation((database: CatalogDatabase, sites: string[]) => {
            MOCK_MIRROR_SITES[database] = sites;
        });
    });

    test("updates benchmark observables inside actions after asynchronous requests", async () => {
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
            expect(component.mirrorBenchmarks.get("fast")).toEqual({status: "ok", ms: 50});
            expect(component.mirrorBenchmarks.get("slow")).toEqual({status: "ok", ms: 200});
            expect(MOCK_PREFERENCE_STORE.setCatalogQueryMirrors).toHaveBeenCalledWith(CatalogDatabase.SIMBAD, ["fast", "slow"]);
            expect(consoleWarn).not.toHaveBeenCalled();
        } finally {
            dispose();
            consoleWarn.mockRestore();
        }
    });

    test("does not benchmark HTTP mirrors on secure pages", async () => {
        const component = new CatalogQueryComponent({}) as unknown as TestableCatalogQueryComponent;
        MOCK_MIRROR_SITES[CatalogDatabase.SIMBAD] = ["http://legacy.example/", "https://secure.example/"];
        MOCK_PREFERENCE_STORE.isCatalogQueryMirrorDisabled.mockImplementation((site: string) => site.startsWith("http://"));
        (CatalogApiService.Instance.benchmarkMirror as jest.Mock).mockResolvedValue(50);

        await component.runMirrorBenchmark();

        expect(CatalogApiService.Instance.benchmarkMirror).toHaveBeenCalledTimes(1);
        expect(CatalogApiService.Instance.benchmarkMirror).toHaveBeenCalledWith(CatalogDatabase.SIMBAD, "https://secure.example/", 10000, expect.anything());
        expect(component.mirrorBenchmarks.get("http://legacy.example/")).toEqual({status: "disabled"});
    });

    test("keeps the last usable HTTPS mirror when HTTP mirrors are configured", () => {
        const component = new CatalogQueryComponent({}) as unknown as TestableCatalogQueryComponent;
        MOCK_PREFERENCE_STORE.isCatalogQueryMirrorDisabled.mockImplementation((site: string) => site.startsWith("http://"));

        expect(component.isMirrorRemovalDisabled("https://secure.example/", 2, 1, false)).toBe(true);
        expect(component.isMirrorRemovalDisabled("http://legacy.example/", 2, 1, false)).toBe(false);
        expect(component.isMirrorRemovalDisabled("https://secure.example/", 2, 2, false)).toBe(false);
    });

    test("updates drag observables inside actions", () => {
        const component = new CatalogQueryComponent({}) as unknown as TestableCatalogQueryComponent;
        const consoleWarn = jest.spyOn(console, "warn").mockImplementation();
        const dispose = autorun(() => {
            void component.dragSourceMirrorIndex;
            void component.dragOverMirrorIndex;
        });
        const setData = jest.fn();
        const setDragImage = jest.fn();
        const dragHandle = document.createElement("div");
        const mirrorItem = document.createElement("div");
        jest.spyOn(dragHandle, "closest").mockReturnValue(mirrorItem);
        const dragStartEvent = {currentTarget: dragHandle, dataTransfer: {effectAllowed: "none", setData, setDragImage}} as unknown as DragEvent<HTMLDivElement>;
        const dragOverEvent = {preventDefault: jest.fn()} as unknown as DragEvent<HTMLDivElement>;

        try {
            component.handleMirrorDragStart(1)(dragStartEvent);
            component.handleMirrorDragOver(2)(dragOverEvent);

            expect(component.dragSourceMirrorIndex).toBe(1);
            expect(component.dragOverMirrorIndex).toBe(2);
            expect(setData).toHaveBeenCalledWith("text/plain", "1");
            expect(setDragImage).toHaveBeenCalledWith(mirrorItem, 0, 0);

            component.handleMirrorDragEnd();
            expect(component.dragSourceMirrorIndex).toBeUndefined();
            expect(component.dragOverMirrorIndex).toBeUndefined();
            expect(consoleWarn).not.toHaveBeenCalled();
        } finally {
            dispose();
            consoleWarn.mockRestore();
        }
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
