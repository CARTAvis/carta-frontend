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

jest.mock("services", () => ({SplatalogueService: {Instance: {}}}));
jest.mock("stores", () => ({
    AppStore: {
        Instance: {
            widgetsStore: {
                spectralProfilerList: []
            }
        }
    }
}));
jest.mock("utilities", () => ({
    ...jest.requireActual("utilities"),
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
});
