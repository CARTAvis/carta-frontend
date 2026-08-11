jest.mock("components/Shared", () => ({ColormapComponent: jest.fn(), SafeNumericInput: jest.fn()}));

import {ScatterPlotSettingsPanelComponent, type ScatterPlotSettingsPanelComponentProps} from "./ScatterPlotSettingsPanelComponent";

interface TestableScatterPlotSettingsPanelComponent {
    props: ScatterPlotSettingsPanelComponentProps;
    colormapPreviewSession: unknown;
    handleColormapHovered: (colormap: string) => void;
    handleColormapSelected: (colormap: string) => void;
    handleColormapDropdownOpenChange: (isOpen: boolean) => void;
    componentDidUpdate: (prevProps: ScatterPlotSettingsPanelComponentProps) => void;
    componentWillUnmount: () => void;
}

function createProps(colorMap: string = "inferno"): ScatterPlotSettingsPanelComponentProps {
    const props = {
        colorMap,
        setColormap: jest.fn((colormap: string) => (props.colorMap = colormap))
    };
    return props as unknown as ScatterPlotSettingsPanelComponentProps;
}

function createComponent(props: ScatterPlotSettingsPanelComponentProps): TestableScatterPlotSettingsPanelComponent {
    const component = Object.create(ScatterPlotSettingsPanelComponent.prototype) as TestableScatterPlotSettingsPanelComponent;
    component.props = props;
    component.colormapPreviewSession = null;
    return component;
}

describe("ScatterPlotSettingsPanelComponent colormap preview", () => {
    test("reverts the preview when the dropdown closes", () => {
        const props = createProps();
        const component = createComponent(props);

        component.handleColormapHovered("viridis");
        expect(props.colorMap).toBe("viridis");

        component.handleColormapDropdownOpenChange(false);
        expect(props.colorMap).toBe("inferno");
    });

    test("keeps a committed colormap selection", () => {
        const props = createProps();
        const component = createComponent(props);

        component.handleColormapHovered("viridis");
        component.handleColormapSelected("magma");
        component.handleColormapDropdownOpenChange(false);

        expect(props.colorMap).toBe("magma");
    });

    test("reverts the previous settings source when the setter changes", () => {
        const firstProps = createProps();
        const secondProps = createProps("plasma");
        const component = createComponent(firstProps);

        component.handleColormapHovered("viridis");
        const previousProps = component.props;
        component.props = secondProps;
        component.componentDidUpdate(previousProps);

        expect(firstProps.colorMap).toBe("inferno");
        expect(secondProps.colorMap).toBe("plasma");
    });

    test("reverts an active preview when unmounted", () => {
        const props = createProps();
        const component = createComponent(props);

        component.handleColormapHovered("viridis");
        component.componentWillUnmount();

        expect(props.colorMap).toBe("inferno");
    });
});
