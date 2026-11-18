import {LayerListSettingsTabs} from "enums";

import {LayerListWidgetStore} from "./LayerListWidgetStore";

jest.mock("stores", () => ({AppStore: {Instance: {frames: []}}}));

describe("LayerListWidgetStore in the layout copy of a workspace", () => {
    test("saves the tab of the settings panel, the rest frequency image and the column widths, and applies them again", () => {
        const store = new LayerListWidgetStore();
        store.setSettingsTabId(LayerListSettingsTabs.REST_FREQ);
        store.setSelectedFrameIndex(1);
        store.setColumnWidth(2, 200);

        const config = store.toWorkspaceLayoutConfig();
        expect(config).toEqual({settingsTabId: LayerListSettingsTabs.REST_FREQ, restFrequencyImageIndex: 1, columnWidths: [132, 97, 200, 75, 95]});

        const restored = new LayerListWidgetStore();
        restored.applyWorkspaceLayoutConfig(JSON.parse(JSON.stringify(config)));
        expect(restored.toWorkspaceLayoutConfig()).toEqual(config);
    });

    test("leaves out the rest frequency image when the tab follows the active image, and keeps the defaults of values that are not valid", () => {
        const store = new LayerListWidgetStore();
        expect(store.toWorkspaceLayoutConfig()).toEqual({settingsTabId: LayerListSettingsTabs.MATCHING, columnWidths: [132, 97, 140, 75, 95]});

        store.applyWorkspaceLayoutConfig({settingsTabId: 7, restFrequencyImageIndex: -3, columnWidths: [1, 2]} as never);
        expect([store.settingsTabId, store.selectedFrameIndex, store.columnWidths]).toEqual([LayerListSettingsTabs.MATCHING, -1, [132, 97, 140, 75, 95]]);
    });
});
