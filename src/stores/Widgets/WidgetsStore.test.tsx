import type React from "react";

import {AppStore} from "stores/AppStore/AppStore";

import {WidgetsStore} from "./WidgetsStore";

describe("WidgetsStore PV preview test ids", () => {
    const appStoreMock = {
        activeImage: null,
        darkTheme: false,
        imageViewConfigStore: {visibleImages: []}
    };

    beforeEach(() => {
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue(appStoreMock as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("uses the docked tab id for PV preview test ids while preserving the parent widget id for rendering", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        const node = {
            getComponent: () => "pv-preview",
            getConfig: () => ({id: "pv-generator-2"}),
            getId: () => "pv-preview-2",
            getName: () => "PV Preview"
        };
        const componentId = (widgetsStore as any).getWidgetComponentId(node as any);
        const testId = (widgetsStore as any).getWidgetTestId(node as any);

        const renderValues: {content?: React.ReactElement} = {};
        widgetsStore.onRenderTab(node as any, renderValues as any);

        expect(componentId).toBe("pv-generator-2");
        expect(testId).toBe("pv-preview-2");
        expect(renderValues.content?.props.nodeId).toBe("pv-preview-2");
    });

    test("uses the docked tab id for PV preview toolbar buttons", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        const selectedNode = {
            getComponent: () => "pv-preview",
            getId: () => "pv-preview-3"
        };
        const tabSetNode = {
            canMaximize: () => false,
            getSelectedNode: () => selectedNode
        };
        const renderValues: {buttons?: React.ReactNode[]} = {};

        widgetsStore.onRenderTabSet(tabSetNode as any, renderValues as any);

        const buttons = (renderValues.buttons || []) as React.ReactElement[];

        expect(buttons).toHaveLength(1);
        expect(buttons[0].props["data-testid"]).toBe("pv-preview-3-header-dock-button");
    });
});
