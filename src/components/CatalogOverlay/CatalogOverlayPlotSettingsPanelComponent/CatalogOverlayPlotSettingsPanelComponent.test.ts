import {FrameScaling} from "enums";
import {type CatalogWidgetStore} from "stores/Widgets";

import {CatalogOverlayPlotSettingsPanelComponent} from "./CatalogOverlayPlotSettingsPanelComponent";

type CatalogScalingKey = "sizeScalingType" | "sizeMinorScalingType" | "colorScalingType" | "orientationScalingType";

interface TestableCatalogSettingsComponent {
    scalingPreviewSessions: Map<CatalogScalingKey, unknown>;
    colormapPreviewSession: unknown;
    handleScalingHovered: (widgetStore: CatalogWidgetStore, key: CatalogScalingKey, scaling: FrameScaling) => void;
    handleScalingSelected: (widgetStore: CatalogWidgetStore, key: CatalogScalingKey, scaling: FrameScaling) => void;
    handleScalingDropdownOpenChange: (key: CatalogScalingKey, isOpen: boolean) => void;
    handleColormapHovered: (widgetStore: CatalogWidgetStore, colormap: string) => void;
    handleColormapSelected: (widgetStore: CatalogWidgetStore, colormap: string) => void;
    handleColormapDropdownOpenChange: (isOpen: boolean) => void;
    renderScalingParameter: (
        scaling: FrameScaling,
        value: number,
        onValueChange: (value: number) => void,
        isDisabled: boolean
    ) => {
        props: {
            label: string;
            disabled?: boolean;
            children: {props: {scaling: FrameScaling; value?: number; disabled?: boolean}};
        };
    };
}

function createWidgetStore(): CatalogWidgetStore {
    const widgetStore = {
        sizeScalingType: FrameScaling.LINEAR,
        sizeMinorScalingType: FrameScaling.LINEAR,
        colorScalingType: FrameScaling.LINEAR,
        orientationScalingType: FrameScaling.LINEAR,
        colorMap: "inferno",
        setSizeScalingType: jest.fn((scaling: FrameScaling) => (widgetStore.sizeScalingType = scaling)),
        setSizeMinorScalingType: jest.fn((scaling: FrameScaling) => (widgetStore.sizeMinorScalingType = scaling)),
        setColorScalingType: jest.fn((scaling: FrameScaling) => (widgetStore.colorScalingType = scaling)),
        setOrientationScalingType: jest.fn((scaling: FrameScaling) => (widgetStore.orientationScalingType = scaling)),
        setColorMap: jest.fn((colormap: string) => (widgetStore.colorMap = colormap))
    };
    return widgetStore as unknown as CatalogWidgetStore;
}

function createComponent(): TestableCatalogSettingsComponent {
    const component = Object.create(CatalogOverlayPlotSettingsPanelComponent.prototype) as TestableCatalogSettingsComponent;
    component.scalingPreviewSessions = new Map();
    component.colormapPreviewSession = null;
    return component;
}

describe("CatalogOverlayPlotSettingsPanelComponent scaling preview", () => {
    test("keeps a disabled parameter row for parameterless scalings", () => {
        const parameterRow = createComponent().renderScalingParameter(FrameScaling.LINEAR, 1, jest.fn(), false);

        expect(parameterRow.props.label).toBe("Gamma");
        expect(parameterRow.props.disabled).toBe(true);
        expect(parameterRow.props.children.props).toMatchObject({scaling: FrameScaling.GAMMA, value: undefined, disabled: true});
    });

    test("keeps an enabled parameter row for parameterized scalings", () => {
        const parameterRow = createComponent().renderScalingParameter(FrameScaling.SINH, 0.5, jest.fn(), false);

        expect(parameterRow.props.label).toBe("Alpha");
        expect(parameterRow.props.disabled).toBe(false);
        expect(parameterRow.props.children.props).toMatchObject({scaling: FrameScaling.SINH, value: 0.5, disabled: false});
    });

    test.each(["sizeScalingType", "sizeMinorScalingType", "colorScalingType", "orientationScalingType"] as CatalogScalingKey[])("previews and reverts %s", key => {
        const widgetStore = createWidgetStore();
        const component = createComponent();

        component.handleScalingHovered(widgetStore, key, FrameScaling.SINH);
        expect(widgetStore[key]).toBe(FrameScaling.SINH);

        component.handleScalingDropdownOpenChange(key, false);
        expect(widgetStore[key]).toBe(FrameScaling.LINEAR);
    });

    test("keeps a committed scaling selection", () => {
        const widgetStore = createWidgetStore();
        const component = createComponent();

        component.handleScalingHovered(widgetStore, "colorScalingType", FrameScaling.SINH);
        component.handleScalingSelected(widgetStore, "colorScalingType", FrameScaling.POWER);
        component.handleScalingDropdownOpenChange("colorScalingType", false);

        expect(widgetStore.colorScalingType).toBe(FrameScaling.POWER);
    });

    test("reverts the previous catalog before previewing another catalog", () => {
        const firstStore = createWidgetStore();
        const secondStore = createWidgetStore();
        const component = createComponent();

        component.handleScalingHovered(firstStore, "sizeScalingType", FrameScaling.SINH);
        component.handleScalingHovered(secondStore, "sizeScalingType", FrameScaling.POWER);

        expect(firstStore.sizeScalingType).toBe(FrameScaling.LINEAR);
        expect(secondStore.sizeScalingType).toBe(FrameScaling.POWER);
    });
});

describe("CatalogOverlayPlotSettingsPanelComponent colormap preview", () => {
    test("reverts the preview when the dropdown closes", () => {
        const widgetStore = createWidgetStore();
        const component = createComponent();

        component.handleColormapHovered(widgetStore, "viridis");
        expect(widgetStore.colorMap).toBe("viridis");

        component.handleColormapDropdownOpenChange(false);
        expect(widgetStore.colorMap).toBe("inferno");
    });

    test("keeps a committed colormap selection", () => {
        const widgetStore = createWidgetStore();
        const component = createComponent();

        component.handleColormapHovered(widgetStore, "viridis");
        component.handleColormapSelected(widgetStore, "magma");
        component.handleColormapDropdownOpenChange(false);

        expect(widgetStore.colorMap).toBe("magma");
    });
});
