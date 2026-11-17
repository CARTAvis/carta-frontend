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
    alertStore: {showAlert: jest.fn()},
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

import {CARTA} from "carta-protobuf";

import {RedshiftType, SpectralLineHeaders, SpectralLineQueryRangeType, SpectralLineQueryUnit} from "enums";
import {SplatalogueService} from "services";
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
            spectralProfilerId: "profiler-a",
            headerTableColumnWidths: [150, 70, 300]
        });

        const restored = new SpectralLineQueryWidgetStore();
        expect(restored.applyWorkspaceConfig(JSON.parse(JSON.stringify(config)))).toEqual([]);
        expect(restored.toWorkspaceConfig()).toEqual(config);
        expect(restored.selectedSpectralProfilerID).toBe("spectral-profiler-1");
        restored.dispose();
    });

    test("chooses the saved spectral profiler before it applies the redshift, and keeps the redshift of a profiler in the rest frame", () => {
        // The first profiler shows its X axis in the rest frame. The query used the second one.
        MOCK_APP_STORE.widgetsStore.spectralProfilerList = ["spectral-profiler-0", "spectral-profiler-1"] as never;
        MOCK_APP_STORE.widgetsStore.getSpectralWidgetStoreByID.mockImplementation(((id: string) =>
            id === "spectral-profiler-0" ? {widgetId: "rest", isXAxisRestFrameActive: true} : {widgetId: "observed", isXAxisRestFrameActive: false}) as never);
        store.setSelectedSpectralProfiler("spectral-profiler-0");

        expect(store.applyWorkspaceConfig({redshiftType: RedshiftType.Z, redshift: 0.01, spectralProfilerId: "observed"} as never)).toEqual([]);
        expect([store.selectedSpectralProfilerID, store.redshiftInput]).toEqual(["spectral-profiler-1", 0.01]);

        // The input is off for a profiler in the rest frame, and it keeps the saved value.
        const other = new SpectralLineQueryWidgetStore();
        expect(other.applyWorkspaceConfig({redshiftType: RedshiftType.Z, redshift: 0.01, spectralProfilerId: "rest"} as never)).toEqual([]);
        expect([other.isRedshiftInputDisabled, other.redshiftInput]).toEqual([true, 0.01]);
        expect(other.toWorkspaceConfig()).toMatchObject({redshift: 0.01});
        other.dispose();
    });

    test("keeps the default of each value that is not valid, and says when the spectral profiler was not restored", () => {
        const problems = store.applyWorkspaceConfig({rangeType: "Width", unit: "Hz", range: [1], intensityLimit: "x", redshiftType: "Speed", spectralProfilerId: "gone"} as never);

        expect(problems).toEqual(["the spectral profiler that it plotted lines on was not restored"]);
        expect([store.queryRangeType, store.queryUnit, store.queryRange, store.intensityLimitValue, store.redshiftType]).toEqual([SpectralLineQueryRangeType.Range, SpectralLineQueryUnit.MHz, [0, 0], -5, RedshiftType.V]);
    });

    describe("with a result table", () => {
        const query = jest.fn();
        // The answer of Splatalogue with three columns: the species, its name and the frequency.
        const ackOf = (rows: number) => ({
            dataSize: rows,
            headers: [SpectralLineHeaders.Species, SpectralLineHeaders.ChemicalName, SpectralLineHeaders.ShiftedFrequency].map((name, columnIndex) => ({name, dataType: CARTA.ColumnType.String, columnIndex})),
            spectralLineData: {rows}
        });

        beforeEach(() => {
            query.mockReset();
            query.mockResolvedValue(ackOf(3));
            (SplatalogueService.Instance as unknown as {query: jest.Mock}).query = query;
            (MOCK_UTILITIES.ProtobufProcessing as {processCatalogData?: jest.Mock}).processCatalogData = jest.fn((data: {rows: number}) => {
                const columnOf = (values: string[]) => ({dataType: CARTA.ColumnType.String, data: values.slice(0, data.rows)});
                return new Map([
                    [0, columnOf(["CO", "CS", "HCN"])],
                    [1, columnOf(["Carbon Monoxide", "Carbon Monosulfide", "Hydrogen cyanide"])],
                    [2, columnOf(["230538", "244935", "265886"])]
                ]);
            });
            MOCK_UTILITIES.stringFiltering.mockReturnValue([0, 2] as never);
        });

        const showResult = async () => {
            store.setQueryRange([230, 231]);
            store.setQueryUnit(SpectralLineQueryUnit.GHz);
            await store.query();
            store.selectSingleLine(2);
            store.setHeaderDisplay(false, SpectralLineHeaders.Species);
            store.setColumnFilter("C*", SpectralLineHeaders.Species);
            store.filter();
            store.setSortingInfo(SpectralLineHeaders.Species, CARTA.SortingType.Descending);
            store.setResultTableColumnWidth(80, SpectralLineHeaders.Species);
            store.setHeaderTableColumnWidth(2, 250);
            return store.toWorkspaceConfig();
        };

        test("saves the query of the result and the table settings, and queries again on restore", async () => {
            const config = await showResult();

            expect(config.headerTableColumnWidths).toEqual([150, 70, 250]);
            expect(config.result).toEqual({
                frequencyRange: [230000, 231000],
                intensityLimit: -5,
                rowCount: 3,
                columns: {
                    [SpectralLineHeaders.LineSelection]: {display: true, filter: "", width: 50},
                    [SpectralLineHeaders.Species]: {display: false, filter: "C*", width: 80},
                    [SpectralLineHeaders.ChemicalName]: {display: true, filter: "", width: 150},
                    [SpectralLineHeaders.ShiftedFrequency]: {display: true, filter: "", width: 165}
                },
                filtered: true,
                sort: {columnName: SpectralLineHeaders.Species, sortingType: CARTA.SortingType.Descending},
                selectedRows: [2]
            });

            // The form shows other settings than the query of the result. The restore queries with the saved query.
            const saved = JSON.parse(JSON.stringify({...config, range: [1, 2]}));
            const restored = new SpectralLineQueryWidgetStore();
            restored.applyWorkspaceConfig(saved);
            query.mockClear();
            expect(await restored.restoreWorkspaceResult(saved)).toEqual([]);

            expect(query).toHaveBeenCalledWith(230000, 231000, -5);
            expect(restored.toWorkspaceConfig()).toEqual(saved);
            expect(restored.resultTableInfo).toBe("Showing 2 filtered line(s) of total 3 line(s). Applied 1 filter(s). Selected 1 line(s).");
            restored.dispose();
        });

        test("shows a result that comes after the restore stopped waiting without its saved settings", async () => {
            const config = await showResult();
            const restored = new SpectralLineQueryWidgetStore();

            expect(await restored.restoreWorkspaceResult(JSON.parse(JSON.stringify(config)), () => false)).toEqual([]);

            expect(restored.resultTableInfo).toBe("Showing 3 line(s).");
            restored.dispose();
        });

        test("does not save a result after a query that failed", async () => {
            query.mockRejectedValue("Error: timeout");
            store.setQueryRange([230, 231]);
            store.setQueryUnit(SpectralLineQueryUnit.GHz);
            await store.query();

            expect(store.toWorkspaceConfig()).not.toHaveProperty("result");
        });

        test("says when the query fails again, and keeps the selection out of a result of another size", async () => {
            const config = await showResult();
            const restored = new SpectralLineQueryWidgetStore();

            query.mockRejectedValueOnce("Error: timeout");
            expect(await restored.restoreWorkspaceResult(config)).toEqual(["could not query the spectral lines again: Error: timeout"]);

            query.mockResolvedValueOnce(ackOf(2));
            expect(await restored.restoreWorkspaceResult(config)).toEqual(["the spectral line query now returns 2 lines instead of 3, so the selected lines were not restored"]);
            expect(restored.numSelectedLines).toBe(0);
            restored.dispose();
        });
    });
});
