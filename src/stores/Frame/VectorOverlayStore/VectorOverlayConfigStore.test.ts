import {CARTA} from "carta-protobuf";

import {VectorOverlaySource} from "enums/vector";
import {type WorkspaceVectorOverlayConfig} from "models/Workspace";
import {type FrameStore} from "stores/Frame/FrameStore";
import {type PreferenceStore} from "stores/PreferenceStore/PreferenceStore";

import {VectorOverlayConfigStore} from "./VectorOverlayConfigStore";

const WORKSPACE_SCHEMA = require("carta-schemas/workspace_schema_2.json");

function createStore(isDefaultInverted: boolean): VectorOverlayConfigStore {
    const preference = {
        vectorOverlayColor: "#00ff00",
        isVectorOverlayColormapEnabled: true,
        isVectorOverlayColormapInverted: isDefaultInverted,
        vectorOverlayColormap: "viridis",
        vectorOverlayThickness: 1,
        isVectorOverlayFractionalIntensity: false,
        vectorOverlayPixelAveraging: 1
    } as PreferenceStore;
    const frame = {hasLinearStokes: false} as FrameStore;

    return new VectorOverlayConfigStore(preference, frame);
}

function createWorkspaceConfig(isColormapInverted?: boolean): WorkspaceVectorOverlayConfig {
    return {
        angularSource: VectorOverlaySource.Current,
        intensitySource: VectorOverlaySource.Current,
        fractionalIntensity: false,
        pixelAveraging: 1,
        thresholdEnabled: false,
        threshold: 0,
        debiasing: false,
        qError: 0,
        uError: 0,
        thresholdOption: CARTA.PolarizationType.I,
        visible: true,
        thickness: 1,
        colormapEnabled: true,
        colormapInverted: isColormapInverted,
        colormap: "viridis",
        colormapContrast: 1,
        colormapBias: 0,
        lengthMin: 0,
        lengthMax: 20,
        intensityMin: undefined,
        intensityMax: undefined,
        rotationOffset: 0
    };
}

describe("VectorOverlayConfigStore workspace colormap inversion", () => {
    test("uses the historical non-inverted behavior when a legacy workspace omits the setting", () => {
        const store = createStore(true);

        store.applyConfig(createWorkspaceConfig());

        expect(store.isColormapInverted).toBe(false);
    });

    test("restores an explicit inverted workspace setting", () => {
        const store = createStore(false);

        store.applyConfig(createWorkspaceConfig(true));

        expect(store.isColormapInverted).toBe(true);
    });
});

describe("VectorOverlayConfigStore workspace round trip", () => {
    test("writes only fields the workspace schema declares", () => {
        const store = createStore(false);
        store.setEnabled(true);
        store.applyConfig(createWorkspaceConfig(true));

        const declared = WORKSPACE_SCHEMA.definitions["vector-overlay-config"].properties;

        expect(Object.keys(store.toConfig()!).filter(key => !(key in declared))).toEqual([]);
    });

    test("returns the applied config", () => {
        const store = createStore(false);
        store.setEnabled(true);
        const config = createWorkspaceConfig(true);

        store.applyConfig(config);

        expect(store.toConfig()).toEqual({...config, color: store.color});
    });

    test("returns nothing when the vector overlay is disabled", () => {
        const store = createStore(false);

        store.applyConfig(createWorkspaceConfig(true));

        expect(store.toConfig()).toBeUndefined();
    });
});

describe("VectorOverlayConfigStore settings of a vector overlay that is off", () => {
    const frame = {hasLinearStokes: false} as FrameStore;

    test("gives nothing when the settings are the ones that a new image starts with", () => {
        expect(createStore(false).toUnappliedConfig(frame)).toBeUndefined();
    });

    test("gives the settings when the overlay is off and a setting changed, and nothing when it is on", () => {
        const store = createStore(false);
        store.setThickness(3);
        expect(store.toUnappliedConfig(frame)?.thickness).toBe(3);

        store.setEnabled(true);
        expect(store.toUnappliedConfig(frame)).toBeUndefined();
    });
});

describe("VectorOverlayConfigStore settings that a workspace leaves out", () => {
    test("keeps the value that an image starts with for each setting that is left out or not valid", () => {
        const store = createStore(false);
        const before = {pixelAveraging: store.pixelAveraging, thickness: store.thickness, isVisible: store.isVisible, lengthMax: store.lengthMax, angularSource: store.angularSource};

        store.applyConfig({thickness: "2", pixelAveraging: 1.5} as never);

        expect({pixelAveraging: store.pixelAveraging, thickness: store.thickness, isVisible: store.isVisible, lengthMax: store.lengthMax, angularSource: store.angularSource}).toEqual(before);
        expect([store.intensityMin, store.intensityMax]).toEqual([undefined, undefined]);
    });
});
