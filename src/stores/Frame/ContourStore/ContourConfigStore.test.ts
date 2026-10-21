import {CARTA} from "carta-protobuf";

import {ContourDashMode} from "enums/contour";
import {type WorkspaceContourConfig} from "models/Workspace";
import {type PreferenceStore} from "stores/PreferenceStore/PreferenceStore";
import {undeclaredFields} from "utilities/schema/pendingSchemaFields";

import {ContourConfigStore} from "./ContourConfigStore";

const WORKSPACE_SCHEMA = require("carta-schemas/workspace_schema_2.json");

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

        store.applyConfig(createWorkspaceConfig());

        expect(store.isColormapInverted).toBe(false);
    });

    test("restores an explicit inverted workspace setting", () => {
        const store = createStore(false);

        store.applyConfig(createWorkspaceConfig(true));

        expect(store.isColormapInverted).toBe(true);
    });
});

describe("ContourConfigStore workspace round trip", () => {
    test("writes only fields the workspace schema declares", () => {
        const store = createStore(false);
        store.setEnabled(true);
        store.applyConfig(createWorkspaceConfig(true));

        expect(undeclaredFields("workspace/contour-config", WORKSPACE_SCHEMA.definitions["contour-config"].properties, store.toConfig()!)).toEqual([]);
    });

    test("returns the applied config", () => {
        const store = createStore(false);
        store.setEnabled(true);
        const config = createWorkspaceConfig(true);

        store.applyConfig(config);

        expect(store.toConfig()).toEqual({...config, color: store.color});
    });

    test("returns nothing when contours are disabled", () => {
        const store = createStore(false);

        store.applyConfig(createWorkspaceConfig(true));

        expect(store.toConfig()).toBeUndefined();
    });
});
