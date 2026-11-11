jest.mock("stores", () => ({AppStore: {}}));

import {LayoutConfig} from "./LayoutConfig";

describe("LayoutConfig.createConfigToSave", () => {
    /** A session with two floating widgets. The first widget opened is now on top of the second. */
    const createSession = () => {
        const widgets = [
            {id: "log", type: "log", defaultWidth: 300, defaultHeight: 200, defaultX: 0, defaultY: 0},
            {id: "stats-0", type: "stats", defaultWidth: 400, defaultHeight: 300, defaultX: 40, defaultY: 60}
        ];
        const zIndexes = new Map([
            ["log", 2],
            ["stats-0", 1]
        ]);
        return {
            widgetsStore: {floatingWidgets: widgets, toWidgetSettingsConfig: jest.fn(() => undefined)},
            zIndexManager: {findIndex: (id: string) => zIndexes.get(id) ?? 0}
        };
    };
    const modelJson = {global: {}, layout: {type: "row", children: [{type: "tabset", children: [{type: "tab", id: "image-view", component: "image-view"}]}]}};

    test("saves the floating widgets from the bottom one to the top one, with a position at the edge", () => {
        const config = LayoutConfig.createConfigToSave(createSession() as never, modelJson);

        expect(config?.floating).toEqual([
            {type: "component", id: "stats", defaultWidth: 400, defaultHeight: 300, defaultX: 40, defaultY: 60},
            {type: "component", id: "log", defaultWidth: 300, defaultHeight: 200, defaultX: 0, defaultY: 0}
        ]);
    });
});

describe("LayoutConfig.createConfigToApply", () => {
    test("keeps a maximized stack maximized", () => {
        const applied: any[] = [];
        LayoutConfig.createConfigToApply(
            applied,
            [
                {type: "stack", content: []},
                {type: "stack", maximized: true, content: []}
            ],
            []
        );

        expect(applied.map(stack => stack.maximized)).toEqual([undefined, true]);
    });
});
