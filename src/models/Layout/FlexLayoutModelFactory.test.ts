import {createFlexLayoutModel, extractAbstractConfig} from "./FlexLayoutModelFactory";

const CollectTabIds = (node: any): string[] => {
    if (!node) {
        return [];
    }

    if (node.type === "tab") {
        return [node.id];
    }

    return (node.children || []).flatMap((child: any) => CollectTabIds(child));
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
});
