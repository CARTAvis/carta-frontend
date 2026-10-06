const MOCK_APP_STORE = {
    widgetsStore: {
        removeFloatingWidgets: jest.fn(),
        clearDockedWidgets: jest.fn(),
        clearPopoutPositions: jest.fn(),
        initWidgets: jest.fn(),
        updateImageWidgetTitle: jest.fn(),
        floatingWidgets: [] as any[],
        toWidgetSettingsConfig: jest.fn(),
        catalogPlotWidgets: new Map()
    },
    catalogStore: {widgetBindings: {displayedForWidget: () => ({widgetId: ""})}},
    alertStore: {showAlert: jest.fn()}
};

jest.mock("stores", () => ({
    AppStore: {Instance: MOCK_APP_STORE},
    AlertStore: {Instance: MOCK_APP_STORE.alertStore}
}));
jest.mock("components/Shared", () => ({AppToaster: {show: jest.fn()}, SuccessToast: jest.fn()}));
jest.mock("services", () => ({ApiService: {Instance: {}}}));

import {Model} from "flexlayout-react";
import {runInAction} from "mobx";

import {LayoutConfig, PresetLayout} from "models";

import {LayoutStore} from "./LayoutStore";

/** The widget types a layout config docks, in the order they appear. */
const DockedComponentIds = (node: any): string[] => {
    if (node?.type === "component") {
        return [node.id];
    }
    return (node?.content ?? []).flatMap(DockedComponentIds);
};

describe("LayoutStore layout configs", () => {
    const layoutStore = LayoutStore.Instance;
    const defaultConfig = () => LayoutConfig.getPresetConfig(PresetLayout.DEFAULT);

    beforeEach(() => {
        jest.clearAllMocks();
        // flexlayout-react is mocked for every test; a model here gives back the JSON it was built from.
        (Model.fromJson as jest.Mock).mockImplementation(json => ({setOnAllowDrop: jest.fn(), toJson: () => json}));
        runInAction(() => {
            layoutStore.layoutModel = null;
            layoutStore.currentLayoutName = PresetLayout.DEFAULT;
        });
    });

    test("puts a layout config's widgets in place, naming no saved layout", () => {
        expect(layoutStore.applyLayoutConfig(defaultConfig())).toBe(true);

        expect(MOCK_APP_STORE.widgetsStore.clearDockedWidgets).toHaveBeenCalledTimes(1);
        expect(MOCK_APP_STORE.widgetsStore.initWidgets).toHaveBeenCalledTimes(1);
        const [dockedConfigs, floatingConfigs] = MOCK_APP_STORE.widgetsStore.initWidgets.mock.calls[0];
        expect(dockedConfigs.map((config: any) => config.id)).toEqual(DockedComponentIds(defaultConfig()!.docked));
        expect(floatingConfigs).toEqual([]);
        expect(layoutStore.layoutModel).not.toBeNull();
        expect(layoutStore.currentLayoutName).toBe("");
    });

    test("names the saved layout it applies", () => {
        expect(layoutStore.applyLayout(PresetLayout.CUBEVIEW)).toBe(true);

        expect(layoutStore.currentLayoutName).toBe(PresetLayout.CUBEVIEW);
    });

    test("leaves the current layout in place when the config is not a valid layout", () => {
        layoutStore.applyLayoutConfig(defaultConfig());
        const layoutModel = layoutStore.layoutModel;
        MOCK_APP_STORE.widgetsStore.clearDockedWidgets.mockClear();
        MOCK_APP_STORE.widgetsStore.initWidgets.mockClear();
        jest.spyOn(console, "error").mockImplementation(jest.fn());

        expect(layoutStore.applyLayoutConfig({docked: {type: "not-a-layout"}})).toBe(false);
        expect(layoutStore.applyLayoutConfig(undefined)).toBe(false);

        expect(layoutStore.layoutModel).toBe(layoutModel);
        expect(MOCK_APP_STORE.widgetsStore.clearDockedWidgets).not.toHaveBeenCalled();
        expect(MOCK_APP_STORE.widgetsStore.initWidgets).not.toHaveBeenCalled();
        expect(layoutStore.currentLayoutName).toBe("");
    });

    test("reports no layout config before a layout is shown", () => {
        expect(layoutStore.currentLayoutConfig()).toBeUndefined();
    });

    test("gives back the layout it shows in the form it was applied from", () => {
        layoutStore.applyLayoutConfig(defaultConfig());

        const config = layoutStore.currentLayoutConfig();

        expect(config).toMatchObject({layoutVersion: LayoutConfig.currentSchemaVersion, floating: []});
        expect(DockedComponentIds(config?.docked)).toEqual(DockedComponentIds(defaultConfig()!.docked));
        expect(LayoutConfig.prepareLayout(config)).toBeDefined();
    });
});
