import {canPopoutWidget, createFlexLayoutModel, extractAbstractConfig, getComponentTabJson} from "./FlexLayoutModelFactory";

const CollectTabIds = (node: any): string[] => {
    if (!node) {
        return [];
    }

    if (node.type === "tab") {
        return [node.id];
    }

    return (node.children || []).flatMap((child: any) => CollectTabIds(child));
};

const CollectTabs = (node: any): any[] => {
    if (!node) {
        return [];
    }

    if (node.type === "tab") {
        return [node];
    }

    return (node.children || []).flatMap((child: any) => CollectTabs(child));
};

const StripInstanceIds = (node: any): any => {
    if (Array.isArray(node)) {
        return node.map(StripInstanceIds);
    }

    if (!node || typeof node !== "object") {
        return node;
    }

    const result = {...node};
    delete result._instanceId;

    if (result.content) {
        result.content = StripInstanceIds(result.content);
    }

    return result;
};

const SPATIAL_PROFILER_TABS = {
    type: "row",
    content: [
        {
            type: "stack",
            content: [
                {type: "component", id: "log"},
                {type: "component", id: "spatial-profiler", widgetSettings: {coordinate: "x"}},
                {type: "component", id: "spatial-profiler", widgetSettings: {coordinate: "y"}},
                {type: "component", id: "spatial-profiler", widgetSettings: {coordinate: "Iy"}},
                {type: "component", id: "spatial-profiler"}
            ]
        }
    ]
};

describe("FlexLayoutModelFactory", () => {
    test("round-trips abstract layout structure while preserving widget settings", () => {
        const dockedConfig = {
            type: "row",
            content: [
                {
                    type: "stack",
                    width: 55,
                    activeItemIndex: 1,
                    content: [
                        {type: "component", id: "image-view", widgetSettings: {zoom: 2}},
                        {type: "component", id: "stats", widgetSettings: {mode: "detailed"}}
                    ]
                },
                {
                    type: "row",
                    width: 45,
                    content: [
                        {
                            type: "stack",
                            width: 30,
                            content: [{type: "component", id: "stats", widgetSettings: {mode: "compact"}}]
                        },
                        {
                            type: "stack",
                            width: 70,
                            content: [{type: "component", id: "catalog-plot", widgetSettings: {plotType: "Histogram"}}]
                        }
                    ]
                }
            ]
        };
        const expectedConfig = JSON.parse(JSON.stringify(dockedConfig));

        const modelJson = createFlexLayoutModel(dockedConfig);
        const tabIds = CollectTabIds(modelJson.layout);
        const extractedConfig = extractAbstractConfig(modelJson);

        expect(tabIds).toHaveLength(4);
        expect(new Set(tabIds).size).toBe(4);
        expect(tabIds).toEqual(expect.arrayContaining(["image-view", "stats-0", "stats-1", "catalog-plot-0"]));
        expect(StripInstanceIds(extractedConfig)).toStrictEqual(expectedConfig);
    });

    test("keeps a maximized stack maximized in the layout copy of a workspace", () => {
        const dockedConfig = {
            type: "row",
            content: [
                {type: "stack", width: 60, content: [{type: "component", id: "image-view"}]},
                {type: "stack", width: 40, maximized: true, content: [{type: "component", id: "log"}]}
            ]
        };

        const expectedConfig = JSON.parse(JSON.stringify(dockedConfig));

        const modelJson = createFlexLayoutModel(dockedConfig, "workspace");

        expect(modelJson.layout.children?.map((child: any) => child.maximized)).toEqual([undefined, true]);
        expect(StripInstanceIds(extractAbstractConfig(modelJson, "workspace"))).toStrictEqual(expectedConfig);
    });

    test("neither applies nor saves a maximized stack in a regular layout, as in CARTA v6.0", () => {
        const dockedConfig = {
            type: "row",
            content: [
                {type: "stack", width: 60, content: [{type: "component", id: "image-view"}]},
                {type: "stack", width: 40, maximized: true, content: [{type: "component", id: "log"}]}
            ]
        };

        const modelJson = createFlexLayoutModel(dockedConfig);

        expect(modelJson.layout.children?.map((child: any) => child.maximized)).toEqual([undefined, undefined]);
        // A stack that a user maximized after the layout was applied is not saved maximized either.
        (modelJson.layout.children?.[1] as any).maximized = true;
        expect((StripInstanceIds(extractAbstractConfig(modelJson)) as any).content[1].maximized).toBeUndefined();
    });

    test("keeps the type of a catalog plot in the config of its tab in a regular layout, as in CARTA v6.0", () => {
        const modelJson = createFlexLayoutModel({type: "row", content: [{type: "stack", content: [{type: "component", id: "catalog-plot", plotType: "Histogram"}]}]});

        expect(CollectTabs(modelJson.layout)[0].config.plotType).toBe("Histogram");
        expect((StripInstanceIds(extractAbstractConfig(modelJson)) as any).content[0].content[0].plotType).toBe("Histogram");
        expect((StripInstanceIds(extractAbstractConfig(modelJson, "workspace")) as any).content[0].content[0].plotType).toBeUndefined();
    });

    test("clears generated ids after a failed conversion", () => {
        const badComponent = {type: "component"};
        Object.defineProperty(badComponent, "id", {
            enumerable: true,
            get: () => {
                throw new Error("bad id");
            }
        });

        const invalidConfig = {
            type: "row",
            content: [{type: "component", id: "stats"}, badComponent]
        };

        expect(() => createFlexLayoutModel(invalidConfig)).toThrow("bad id");

        const recoveredModel = createFlexLayoutModel({
            type: "row",
            content: [{type: "component", id: "stats"}]
        });

        expect(CollectTabIds(recoveredModel.layout)).toStrictEqual(["stats-0"]);
    });

    test("names spatial profiler tabs by their coordinate before their widgets mount in the layout copy of a workspace", () => {
        // A tab that is not the one shown in its tabset is not mounted, so it keeps this name.
        const model = createFlexLayoutModel(SPATIAL_PROFILER_TABS, "workspace");

        const tabs = (model.layout.children[0] as any).children;
        expect(tabs.map(tab => tab.name)).toEqual(["Log", "X Profile: Cursor", "Y Profile: Cursor", "IY Profile: Cursor", "X Profile: Cursor"]);
    });

    test("leaves spatial profiler tabs without a name until their widgets mount in a regular layout, as in CARTA v6.0", () => {
        const model = createFlexLayoutModel(SPATIAL_PROFILER_TABS);

        const tabs = (model.layout.children[0] as any).children;
        expect(tabs.map(tab => tab.name)).toEqual(["Log", undefined, undefined, undefined, undefined]);
    });

    test("only image-view tabs enable popout", () => {
        expect(canPopoutWidget("image-view")).toBe(true);
        expect(canPopoutWidget("stats")).toBe(false);
        expect(getComponentTabJson("image-view")?.enablePopout).toBe(true);
        expect(getComponentTabJson("image-view")?.enablePopoutIcon).toBe(true);
        expect(getComponentTabJson("stats")?.enablePopout).toBe(false);
        expect(getComponentTabJson("stats")?.enablePopoutIcon).toBe(false);
    });

    test("created FlexLayout model applies popout flags to live tabs", () => {
        const modelJson = createFlexLayoutModel({
            type: "row",
            content: [
                {type: "component", id: "stats"},
                {type: "component", id: "image-view"}
            ]
        });
        const tabs = CollectTabs(modelJson.layout);
        const statsTab = tabs.find(tab => tab.component === "stats");
        const imageViewTab = tabs.find(tab => tab.component === "image-view");

        expect(modelJson.global.tabEnablePopout).toBe(false);
        expect(modelJson.global.tabEnablePopoutIcon).toBe(false);
        expect(statsTab?.enablePopout).toBe(false);
        expect(statsTab?.enablePopoutIcon).toBe(false);
        expect(imageViewTab?.enablePopout).toBe(true);
        expect(imageViewTab?.enablePopoutIcon).toBe(true);
    });
});
