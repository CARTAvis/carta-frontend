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
                            content: [{type: "component", id: "catalog-plot", plotType: "histogram"}]
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
