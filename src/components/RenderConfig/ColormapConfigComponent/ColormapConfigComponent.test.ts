import {FrameScaling} from "enums";
import {type RenderConfigStore} from "stores/Frame";

import {ColormapConfigComponent} from "./ColormapConfigComponent";

interface TestableColormapConfigComponent {
    props: {renderConfig: RenderConfigStore};
    renderScalingParameter: (renderConfig: RenderConfigStore) => {
        props: {
            label: string;
            disabled?: boolean;
            children: {props: {scaling: FrameScaling; value?: number; disabled?: boolean}};
        };
    };
    handleScalingHovered: (scaling: FrameScaling) => void;
    handleScalingSelected: (scaling: FrameScaling) => void;
    handleScalingDropdownOpenChange: (isOpen: boolean) => void;
    handleColormapHovered: (colormap: string) => void;
    handleColormapSelected: (colormap: string) => void;
    handleColormapDropdownOpenChange: (isOpen: boolean) => void;
    componentDidUpdate: (prevProps: {renderConfig: RenderConfigStore}) => void;
    componentWillUnmount: () => void;
}

function createRenderConfig(scaling: FrameScaling, colorMap: string = "inferno"): RenderConfigStore {
    const renderConfig = {
        scaling,
        colorMap,
        setScaling: jest.fn((newScaling: FrameScaling) => {
            renderConfig.scaling = newScaling;
        }),
        setColorMap: jest.fn((newColorMap: string) => {
            renderConfig.colorMap = newColorMap;
        }),
        getScalingParameter: jest.fn(() => 0.3),
        setScalingParameter: jest.fn()
    };
    return renderConfig as unknown as RenderConfigStore;
}

function createComponent(renderConfig: RenderConfigStore): TestableColormapConfigComponent {
    return new ColormapConfigComponent({renderConfig}) as unknown as TestableColormapConfigComponent;
}

describe("ColormapConfigComponent scaling preview", () => {
    test("renders parameterless scalings as an empty disabled Gamma control", () => {
        const renderConfig = createRenderConfig(FrameScaling.LINEAR);
        const parameterRow = createComponent(renderConfig).renderScalingParameter(renderConfig);

        expect(parameterRow.props.label).toBe("Gamma");
        expect(parameterRow.props.disabled).toBe(true);
        expect(parameterRow.props.children.props).toMatchObject({scaling: FrameScaling.GAMMA, value: undefined, disabled: true});
    });

    test("reverts the original frame when renderConfig changes during a preview", () => {
        const frameA = createRenderConfig(FrameScaling.LINEAR);
        const frameB = createRenderConfig(FrameScaling.POWER);
        const component = createComponent(frameA);

        component.handleScalingHovered(FrameScaling.SINH);
        expect(frameA.scaling).toBe(FrameScaling.SINH);

        const previousProps = component.props;
        component.props = {renderConfig: frameB};
        component.componentDidUpdate(previousProps);

        expect(frameA.scaling).toBe(FrameScaling.LINEAR);
        expect(frameB.scaling).toBe(FrameScaling.POWER);
    });

    test("does not revert a committed selection", () => {
        const renderConfig = createRenderConfig(FrameScaling.LINEAR);
        const component = createComponent(renderConfig);

        component.handleScalingHovered(FrameScaling.SINH);
        component.handleScalingSelected(FrameScaling.SINH);
        component.handleScalingDropdownOpenChange(false);

        expect(renderConfig.scaling).toBe(FrameScaling.SINH);
    });

    test("reverts an active preview when unmounted", () => {
        const renderConfig = createRenderConfig(FrameScaling.LINEAR);
        const component = createComponent(renderConfig);

        component.handleScalingHovered(FrameScaling.ASINH);
        component.componentWillUnmount();

        expect(renderConfig.scaling).toBe(FrameScaling.LINEAR);
    });
});

describe("ColormapConfigComponent colormap preview", () => {
    test("reverts the preview when the dropdown closes", () => {
        const renderConfig = createRenderConfig(FrameScaling.LINEAR, "inferno");
        const component = createComponent(renderConfig);

        component.handleColormapHovered("viridis");
        expect(renderConfig.colorMap).toBe("viridis");

        component.handleColormapDropdownOpenChange(false);

        expect(renderConfig.colorMap).toBe("inferno");
    });

    test("does not revert a committed selection", () => {
        const renderConfig = createRenderConfig(FrameScaling.LINEAR, "inferno");
        const component = createComponent(renderConfig);

        component.handleColormapHovered("viridis");
        component.handleColormapSelected("viridis");
        component.handleColormapDropdownOpenChange(false);

        expect(renderConfig.colorMap).toBe("viridis");
    });
});
