const MOCK_UTILITIES = {
    booleanFiltering: jest.fn(),
    getHasFilter: jest.fn(),
    getInitIndexMap: jest.fn(() => []),
    getSortedIndexMap: jest.fn(() => []),
    numericFiltering: jest.fn(),
    ProtobufProcessing: {},
    stringFiltering: jest.fn(),
    wavelengthToFrequency: jest.fn()
};

const MOCK_APP_STORE = {
    widgetsStore: {
        spectralProfilerList: [],
        getSpectralWidgetStoreByID: jest.fn()
    }
};

jest.mock("services", () => ({SplatalogueService: {Instance: {}}}));
jest.mock("stores", () => ({
    AppStore: {
        Instance: MOCK_APP_STORE
    }
}));
jest.mock("utilities", () => ({
    ...jest.requireActual("utilities"),
    ...MOCK_UTILITIES
}));

import {RedshiftType, SpectralLineQueryRangeType, SpectralLineQueryUnit} from "enums";
import {SPEED_OF_LIGHT_KMS} from "utilities";

import {SpectralLineQueryWidgetStore} from "./SpectralLineQueryWidgetStore";

describe("SpectralLineQueryWidgetStore frequency shift", () => {
    let store: SpectralLineQueryWidgetStore;

    beforeEach(() => {
        store = new SpectralLineQueryWidgetStore();
    });

    afterEach(() => {
        store.dispose();
    });

    test("uses radio velocity without imposing a symmetric speed-of-light limit", () => {
        store.setRedshiftType(RedshiftType.V);
        store.setRedshiftInput(-2 * SPEED_OF_LIGHT_KMS);

        expect(store.redshiftInput).toBe(-2 * SPEED_OF_LIGHT_KMS);
        expect(store.observedFrequencyFactor).toBeCloseTo(3, 10);
    });

    test("rejects radio velocities at or above the speed of light", () => {
        store.setRedshiftType(RedshiftType.V);
        store.setRedshiftInput(SPEED_OF_LIGHT_KMS);

        expect(store.redshiftInput).toBe(0);
        expect(store.observedFrequencyFactor).toBe(1);
    });

    test("uses the inverse redshift factor for query frequencies", () => {
        store.setRedshiftType(RedshiftType.Z);
        store.setRedshiftInput(1);

        expect(store.observedFrequencyFactor).toBe(0.5);
    });

    test("accepts negative redshift for blueshifted query frequencies", () => {
        store.setRedshiftType(RedshiftType.Z);
        store.setRedshiftInput(-0.5);

        expect(store.redshiftInput).toBe(-0.5);
        expect(store.observedFrequencyFactor).toBe(2);
    });

    test("rejects redshift at or below negative one", () => {
        store.setRedshiftType(RedshiftType.Z);
        store.setRedshiftInput(-1);

        expect(store.redshiftInput).toBe(0);
        expect(store.observedFrequencyFactor).toBe(1);
    });

    test("uses rest frequency and disables line-query shifting for an active rest-frame profile", () => {
        store.setRedshiftType(RedshiftType.Z);
        store.setRedshiftInput(1);
        MOCK_APP_STORE.widgetsStore.getSpectralWidgetStoreByID.mockReturnValue({isXAxisRestFrameActive: true});
        store.setSelectedSpectralProfiler("spectral-profiler-1");

        expect(store.isRedshiftInputDisabled).toBe(true);
        expect(store.observedFrequencyFactor).toBe(1);
    });
});

describe("SpectralLineQueryWidgetStore in a workspace", () => {
    let store: SpectralLineQueryWidgetStore;

    beforeEach(() => {
        store = new SpectralLineQueryWidgetStore();
    });

    afterEach(() => {
        store.dispose();
        MOCK_APP_STORE.widgetsStore.spectralProfilerList = [];
        MOCK_APP_STORE.widgetsStore.getSpectralWidgetStoreByID.mockReset();
    });

    test("saves the query settings and the spectral profiler by its widget ID, and applies them again", () => {
        MOCK_APP_STORE.widgetsStore.spectralProfilerList = ["spectral-profiler-1"] as never;
        MOCK_APP_STORE.widgetsStore.getSpectralWidgetStoreByID.mockImplementation(((id: string) => (id === "spectral-profiler-1" ? {widgetId: "profiler-a"} : undefined)) as never);
        store.setSelectedSpectralProfiler("spectral-profiler-1");
        store.setQueryRangeType(SpectralLineQueryRangeType.Center);
        store.setQueryRangeByCenter([230, 0.5]);
        store.setQueryUnit(SpectralLineQueryUnit.GHz);
        store.setIntensityLimitValue(-3);
        store.setRedshiftType(RedshiftType.Z);
        store.setRedshiftInput(0.1);

        const config = store.toWorkspaceConfig();

        expect(config).toEqual({
            rangeType: SpectralLineQueryRangeType.Center,
            range: [store.queryRange[0], store.queryRange[1]],
            rangeByCenter: [230, 0.5],
            unit: SpectralLineQueryUnit.GHz,
            intensityLimitEnabled: true,
            intensityLimit: -3,
            redshiftType: RedshiftType.Z,
            redshift: 0.1,
            spectralProfilerId: "profiler-a"
        });

        const restored = new SpectralLineQueryWidgetStore();
        expect(restored.applyWorkspaceConfig(JSON.parse(JSON.stringify(config)))).toEqual([]);
        expect(restored.toWorkspaceConfig()).toEqual(config);
        expect(restored.selectedSpectralProfilerID).toBe("spectral-profiler-1");
        restored.dispose();
    });

    test("keeps the default of each value that is not valid, and says when the spectral profiler was not restored", () => {
        const problems = store.applyWorkspaceConfig({rangeType: "Width", unit: "Hz", range: [1], intensityLimit: "x", redshiftType: "Speed", spectralProfilerId: "gone"} as never);

        expect(problems).toEqual(["the spectral profiler that it plotted lines on was not restored"]);
        expect([store.queryRangeType, store.queryUnit, store.queryRange, store.intensityLimitValue, store.redshiftType]).toEqual([SpectralLineQueryRangeType.Range, SpectralLineQueryUnit.MHz, [0, 0], -5, RedshiftType.V]);
    });
});
