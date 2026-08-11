jest.mock("components/Shared", () => ({ColormapBlock: jest.fn(), ColormapComponent: jest.fn(), SafeNumericInput: jest.fn()}));
jest.mock("stores", () => ({AppStore: {Instance: {}}, ColorBlendingStore: class {}}));

import {ColormapSet} from "enums";
import {type ColorBlendingStore, type RenderConfigStore} from "stores";

import {ColorBlendingColormapPreviewController} from "./ColorBlendingConfigComponent";

function createRenderConfig(colorMap: string = "inferno", customColormapHexEnd: string = "#ffffff"): RenderConfigStore {
    const renderConfig = {
        colorMap,
        customColormapHexEnd,
        setColorMap: jest.fn((newColormap: string) => (renderConfig.colorMap = newColormap)),
        setCustomHexEnd: jest.fn((hex: string) => (renderConfig.customColormapHexEnd = hex))
    };
    return renderConfig as unknown as RenderConfigStore;
}

function createColorBlendingStore(renderConfigs: RenderConfigStore[]): ColorBlendingStore {
    const store = {
        frames: renderConfigs.map(renderConfig => ({renderConfig, rasterScalingReference: null})),
        applyColormapSet: jest.fn((set: ColormapSet) => {
            renderConfigs.forEach(renderConfig => {
                renderConfig.setCustomHexEnd(`#${set}`);
                renderConfig.setColorMap(set);
            });
        })
    };
    return store as unknown as ColorBlendingStore;
}

describe("ColorBlendingColormapPreviewController layer preview", () => {
    test("reverts a layer preview when the dropdown closes", () => {
        const renderConfig = createRenderConfig();
        const controller = new ColorBlendingColormapPreviewController();

        controller.previewLayer(renderConfig, "viridis");
        expect(renderConfig.colorMap).toBe("viridis");

        controller.closeLayer(renderConfig, false);
        expect(renderConfig.colorMap).toBe("inferno");
    });

    test("keeps a committed layer selection", () => {
        const renderConfig = createRenderConfig();
        const controller = new ColorBlendingColormapPreviewController();

        controller.previewLayer(renderConfig, "viridis");
        controller.commitLayer(renderConfig, "magma");
        controller.closeLayer(renderConfig, false);

        expect(renderConfig.colorMap).toBe("magma");
    });
});

describe("ColorBlendingColormapPreviewController colormap set preview", () => {
    test("restores every layer including its custom color", () => {
        const firstConfig = createRenderConfig("Custom color", "#123456");
        const secondConfig = createRenderConfig("plasma", "#abcdef");
        const store = createColorBlendingStore([firstConfig, secondConfig]);
        const controller = new ColorBlendingColormapPreviewController();

        controller.previewColormapSet(store, ColormapSet.RGB);
        controller.closeColormapSet(false);

        expect(firstConfig.colorMap).toBe("Custom color");
        expect(firstConfig.customColormapHexEnd).toBe("#123456");
        expect(secondConfig.colorMap).toBe("plasma");
        expect(secondConfig.customColormapHexEnd).toBe("#abcdef");
    });

    test("keeps a committed colormap set", () => {
        const renderConfig = createRenderConfig();
        const store = createColorBlendingStore([renderConfig]);
        const controller = new ColorBlendingColormapPreviewController();

        controller.previewColormapSet(store, ColormapSet.RGB);
        controller.commitColormapSet(store, ColormapSet.CMY);
        controller.closeColormapSet(false);

        expect(renderConfig.colorMap).toBe(ColormapSet.CMY);
        expect(renderConfig.customColormapHexEnd).toBe(`#${ColormapSet.CMY}`);
    });
});
