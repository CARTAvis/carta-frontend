import {CARTA} from "carta-protobuf";

import {ContourDashMode} from "enums/contour";
import {type WorkspaceContourConfig} from "models/Workspace";
import {type PreferenceStore} from "stores/PreferenceStore/PreferenceStore";

import {ContourConfigStore} from "./ContourConfigStore";

function createStore(isDefaultInverted: boolean): ContourConfigStore {
    const preference = {
        contourSmoothingMode: CARTA.SmoothingMode.NoSmoothing,
        contourSmoothingFactor: 1,
        contourColor: "#00ff00",
        isContourColormapEnabled: true,
        isContourColormapInverted: isDefaultInverted,
        contourColormap: "viridis",
        contourThickness: 1
    } as PreferenceStore;

    return new ContourConfigStore(preference);
}

function createWorkspaceConfig(isColormapInverted?: boolean): WorkspaceContourConfig {
    return {
        levels: [1],
        smoothingMode: CARTA.SmoothingMode.NoSmoothing,
        smoothingFactor: 1,
        colormapEnabled: true,
        colormapInverted: isColormapInverted,
        colormap: "viridis",
        colormapContrast: 1,
        colormapBias: 0,
        dashMode: ContourDashMode.None,
        thickness: 1,
        visible: true
    };
}

describe("ContourConfigStore workspace colormap inversion", () => {
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
