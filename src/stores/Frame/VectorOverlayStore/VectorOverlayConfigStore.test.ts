import {CARTA} from "carta-protobuf";

import {VectorOverlaySource} from "enums/vector";
import {type WorkspaceVectorOverlayConfig} from "models/Workspace";
import {type FrameStore} from "stores/Frame/FrameStore";
import {type PreferenceStore} from "stores/PreferenceStore/PreferenceStore";

import {VectorOverlayConfigStore} from "./VectorOverlayConfigStore";

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

        store.updateFromWorkspace(createWorkspaceConfig());

        expect(store.isColormapInverted).toBe(false);
    });

    test("restores an explicit inverted workspace setting", () => {
        const store = createStore(false);

        store.updateFromWorkspace(createWorkspaceConfig(true));

        expect(store.isColormapInverted).toBe(true);
    });
});
