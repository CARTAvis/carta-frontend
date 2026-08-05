jest.mock("components/Dialogs", () => ({DraggableDialogComponent: jest.fn()}));
jest.mock("components/Shared", () => ({
    ClearableNumericInputComponent: jest.fn(),
    ColormapComponent: jest.fn(),
    ColorPickerComponent: jest.fn(),
    SafeNumericInput: jest.fn(),
    ScrollShadow: jest.fn()
}));
jest.mock("icons/CustomIcons", () => ({CustomIcon: {}}));
jest.mock("stores", () => ({AppStore: {Instance: {activeFrame: null}}}));
jest.mock("utilities", () => ({SWATCH_COLORS: []}));

import {type VectorOverlayConfigStore} from "stores/Frame";

import {VectorOverlayDialogComponent} from "./VectorOverlayDialogComponent";

interface TestableVectorOverlayDialogComponent {
    colormapPreviewSession: unknown;
    handleColormapHovered: (config: VectorOverlayConfigStore, colormap: string) => void;
    handleColormapSelected: (config: VectorOverlayConfigStore, colormap: string) => void;
    handleColormapDropdownOpenChange: (isOpen: boolean) => void;
    componentWillUnmount: () => void;
}

function createConfig(colormap: string = "inferno"): VectorOverlayConfigStore {
    const config = {
        colormap,
        setColormap: jest.fn((newColormap: string) => (config.colormap = newColormap))
    };
    return config as unknown as VectorOverlayConfigStore;
}

function createComponent(): TestableVectorOverlayDialogComponent {
    const component = Object.create(VectorOverlayDialogComponent.prototype) as TestableVectorOverlayDialogComponent;
    component.colormapPreviewSession = null;
    return component;
}

describe("VectorOverlayDialogComponent colormap preview", () => {
    test("reverts the preview when the dropdown closes", () => {
        const config = createConfig();
        const component = createComponent();

        component.handleColormapHovered(config, "viridis");
        expect(config.colormap).toBe("viridis");

        component.handleColormapDropdownOpenChange(false);
        expect(config.colormap).toBe("inferno");
    });

    test("keeps a committed colormap selection", () => {
        const config = createConfig();
        const component = createComponent();

        component.handleColormapHovered(config, "viridis");
        component.handleColormapSelected(config, "magma");
        component.handleColormapDropdownOpenChange(false);

        expect(config.colormap).toBe("magma");
    });

    test("reverts the previous frame before previewing another frame", () => {
        const firstConfig = createConfig();
        const secondConfig = createConfig("plasma");
        const component = createComponent();

        component.handleColormapHovered(firstConfig, "viridis");
        component.handleColormapHovered(secondConfig, "magma");

        expect(firstConfig.colormap).toBe("inferno");
        expect(secondConfig.colormap).toBe("magma");
    });

    test("reverts an active preview when unmounted", () => {
        const config = createConfig();
        const component = createComponent();

        component.handleColormapHovered(config, "viridis");
        component.componentWillUnmount();

        expect(config.colormap).toBe("inferno");
    });
});
