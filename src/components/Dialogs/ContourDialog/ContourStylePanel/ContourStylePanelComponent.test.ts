jest.mock("components/Shared", () => ({ColormapComponent: jest.fn(), ColorPickerComponent: jest.fn(), SafeNumericInput: jest.fn()}));
jest.mock("utilities", () => ({SWATCH_COLORS: []}));

import {type ContourConfigStore, type FrameStore} from "stores/Frame";

import {ContourStylePanelComponent} from "./ContourStylePanelComponent";

interface TestableContourStylePanelComponent {
    props: {frame: FrameStore; darkTheme: boolean};
    colormapPreviewSession: unknown;
    handleColormapHovered: (config: ContourConfigStore, colormap: string) => void;
    handleColormapSelected: (config: ContourConfigStore, colormap: string) => void;
    handleColormapDropdownOpenChange: (isOpen: boolean) => void;
    componentDidUpdate: (prevProps: {frame: FrameStore; darkTheme: boolean}) => void;
    componentWillUnmount: () => void;
}

function createConfig(colormap: string = "inferno"): ContourConfigStore {
    const config = {
        colormap,
        setColormap: jest.fn((newColormap: string) => (config.colormap = newColormap))
    };
    return config as unknown as ContourConfigStore;
}

function createFrame(config: ContourConfigStore): FrameStore {
    return {contourConfig: config} as unknown as FrameStore;
}

function createComponent(frame: FrameStore): TestableContourStylePanelComponent {
    const component = Object.create(ContourStylePanelComponent.prototype) as TestableContourStylePanelComponent;
    component.props = {frame, darkTheme: false};
    component.colormapPreviewSession = null;
    return component;
}

describe("ContourStylePanelComponent colormap preview", () => {
    test("reverts the preview when the dropdown closes", () => {
        const config = createConfig();
        const component = createComponent(createFrame(config));

        component.handleColormapHovered(config, "viridis");
        expect(config.colormap).toBe("viridis");

        component.handleColormapDropdownOpenChange(false);
        expect(config.colormap).toBe("inferno");
    });

    test("keeps a committed colormap selection", () => {
        const config = createConfig();
        const component = createComponent(createFrame(config));

        component.handleColormapHovered(config, "viridis");
        component.handleColormapSelected(config, "magma");
        component.handleColormapDropdownOpenChange(false);

        expect(config.colormap).toBe("magma");
    });

    test("reverts the previous frame when the data source changes", () => {
        const firstConfig = createConfig();
        const secondConfig = createConfig("plasma");
        const component = createComponent(createFrame(firstConfig));

        component.handleColormapHovered(firstConfig, "viridis");
        const previousProps = component.props;
        component.props = {frame: createFrame(secondConfig), darkTheme: false};
        component.componentDidUpdate(previousProps);

        expect(firstConfig.colormap).toBe("inferno");
        expect(secondConfig.colormap).toBe("plasma");
    });

    test("reverts an active preview when unmounted", () => {
        const config = createConfig();
        const component = createComponent(createFrame(config));

        component.handleColormapHovered(config, "viridis");
        component.componentWillUnmount();

        expect(config.colormap).toBe("inferno");
    });
});
