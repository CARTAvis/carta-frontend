import {rs} from "@rstest/core";

import * as CosmologyUtilities from "utilities/cosmology/cosmology" with {rstest: "importActual"};

const {MOCK_UTILITIES, MOCK_APP_STORE} = rs.hoisted(() => ({
    MOCK_UTILITIES: {
        booleanFiltering: rs.fn(),
        getHasFilter: rs.fn(),
        getInitIndexMap: rs.fn(() => []),
        getSortedIndexMap: rs.fn(() => []),
        numericFiltering: rs.fn(),
        ProtobufProcessing: {},
        stringFiltering: rs.fn(),
        wavelengthToFrequency: rs.fn()
    },
    MOCK_APP_STORE: {
        widgetsStore: {
            spectralProfilerList: [],
            getSpectralWidgetStoreByID: rs.fn()
        }
    }
}));

rs.mock("services", () => ({SplatalogueService: {Instance: {}}}));
rs.mock("stores", () => ({
    AppStore: {
        Instance: MOCK_APP_STORE
    }
}));
rs.mock("utilities", () => ({
    ...CosmologyUtilities,
    ...MOCK_UTILITIES
}));

import {RedshiftType} from "enums";
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
