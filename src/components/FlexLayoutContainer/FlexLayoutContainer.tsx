import * as React from "react";
import {Button, Classes, Position, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import * as FlexLayout from "flexlayout-react";
import {observer} from "mobx-react";

import {
    AnimatorComponent,
    CatalogOverlayComponent,
    CatalogOverlayPlotSettingsPanelComponent,
    CatalogPlotComponent,
    ChannelMapControlComponent,
    CursorInfoComponent,
    HistogramComponent,
    HistogramSettingsPanelComponent,
    ImageViewComponent,
    ImageViewSettingsPanelComponent,
    LayerListComponent,
    LayerListSettingsPanelComponent,
    LogComponent,
    PlaceholderComponent,
    PvGeneratorComponent,
    PvPreviewComponent,
    RegionListComponent,
    RenderConfigComponent,
    RenderConfigSettingsPanelComponent,
    SpatialProfilerComponent,
    SpatialProfilerSettingsPanelComponent,
    SpectralLineQueryComponent,
    SpectralProfilerComponent,
    SpectralProfilerSettingsPanelComponent,
    StatsComponent,
    StokesAnalysisComponent,
    StokesAnalysisSettingsPanelComponent
} from "components";
import {CatalogPlotType, HelpType, ImageType} from "enums";
import {AppStore, HelpStore, WidgetConfig,WidgetsStore} from "stores";
import {FlexLayoutStore} from "stores/FlexLayoutStore";

import "flexlayout-react/style/light.css";
import "../../layout-base.scss";
import "./FlexLayoutContainer.scss";
import "../FloatingWidget/FloatingWidgetComponent.scss";

interface FlexLayoutContainerProps {
    darkTheme: boolean;
}

@observer
export class FlexLayoutContainer extends React.Component<FlexLayoutContainerProps> {
    
    // Map FlexLayout component names to their corresponding widget configs
    private getWidgetConfigFromComponent(component: string) {
        switch (component) {
            case "image-view":
                return ImageViewComponent.WIDGET_CONFIG;
            case "spatial-profiler":
                return SpatialProfilerComponent.WIDGET_CONFIG;
            case "spectral-profiler":
                return SpectralProfilerComponent.WIDGET_CONFIG;
            case "spectral-line-query":
                return SpectralLineQueryComponent.WIDGET_CONFIG;
            case "stats":
                return StatsComponent.WIDGET_CONFIG;
            case "histogram":
                return HistogramComponent.WIDGET_CONFIG;
            case "render-config":
                return RenderConfigComponent.WIDGET_CONFIG;
            case "region-list":
                return RegionListComponent.WIDGET_CONFIG;
            case "layer-list":
                return LayerListComponent.WIDGET_CONFIG;
            case "cursor-info":
                return CursorInfoComponent.WIDGET_CONFIG;
            case "pv-generator":
                return PvGeneratorComponent.WIDGET_CONFIG;
            case "pv-preview":
                return PvPreviewComponent.WIDGET_CONFIG;
            case "log":
                return LogComponent.WIDGET_CONFIG;
            case "animator":
                return AnimatorComponent.WIDGET_CONFIG;
            case "channel-map-control":
                return ChannelMapControlComponent.WIDGET_CONFIG;
            case "stokes":
                return StokesAnalysisComponent.WIDGET_CONFIG;
            case "catalog-overlay":
                return CatalogOverlayComponent.WIDGET_CONFIG;
            case "catalog-plot":
                return CatalogPlotComponent.WIDGET_CONFIG;
            // Settings panels
            case "histogram-settings":
                return HistogramSettingsPanelComponent.WIDGET_CONFIG;
            case "image-view-settings":
                return ImageViewSettingsPanelComponent.WIDGET_CONFIG;
            case "layer-list-settings":
                return LayerListSettingsPanelComponent.WIDGET_CONFIG;
            case "render-config-settings":
                return RenderConfigSettingsPanelComponent.WIDGET_CONFIG;
            case "spatial-profiler-settings":
                return SpatialProfilerSettingsPanelComponent.WIDGET_CONFIG;
            case "spectral-profiler-settings":
                return SpectralProfilerSettingsPanelComponent.WIDGET_CONFIG;
            case "stokes-settings":
                return StokesAnalysisSettingsPanelComponent.WIDGET_CONFIG;
            case "catalog-overlay-settings":
                return CatalogOverlayPlotSettingsPanelComponent.WIDGET_CONFIG;
            default:
                return PlaceholderComponent.WIDGET_CONFIG;
        }
    }
    
    private factory = (node: FlexLayout.TabNode): React.ReactNode => {
        const component = node.getComponent();
        const config = node.getConfig();
        const id = config?.id || node.getId();
        const docked = false; // All FlexLayout widgets are considered docked
        
        const widgetProps = { id, docked };
        console.log("Rendering component:", component, "with id:", id);
        
        switch (component) {
            case "placeholder":
                return <PlaceholderComponent id={id} label="Placeholder" docked={docked} />;
            case "image-view":
                return <ImageViewComponent {...widgetProps} />;
            case "spatial-profiler":
                return <SpatialProfilerComponent {...widgetProps} />;
            case "spectral-profiler":
                return <SpectralProfilerComponent {...widgetProps} />;
            case "spectral-line-query":
                return <SpectralLineQueryComponent {...widgetProps} />;
            case "stats":
                return <StatsComponent {...widgetProps} />;
            case "histogram":
                return <HistogramComponent {...widgetProps} />;
            case "render-config":
                return <RenderConfigComponent {...widgetProps} />;
            case "region-list":
                return <RegionListComponent {...widgetProps} />;
            case "layer-list":
                return <LayerListComponent {...widgetProps} />;
            case "cursor-info":
                return <CursorInfoComponent {...widgetProps} />;
            case "pv-generator":
                return <PvGeneratorComponent {...widgetProps} />;
            case "pv-preview":
                return <PvPreviewComponent {...widgetProps} />;
            case "log":
                return <LogComponent {...widgetProps} />;
            case "animator":
                return <AnimatorComponent {...widgetProps} />;
            case "channel-map-control":
                return <ChannelMapControlComponent {...widgetProps} />;
            case "stokes":
                return <StokesAnalysisComponent {...widgetProps} />;
            case "catalog-overlay":
                return <CatalogOverlayComponent {...widgetProps} />;
            case "catalog-plot":
                return <CatalogPlotComponent {...widgetProps} />;
            // Settings panels
            case "histogram-settings":
                return <HistogramSettingsPanelComponent {...widgetProps} />;
            case "image-view-settings":
                return <ImageViewSettingsPanelComponent {...widgetProps} />;
            case "layer-list-settings":
                return <LayerListSettingsPanelComponent {...widgetProps} />;
            case "render-config-settings":
                return <RenderConfigSettingsPanelComponent {...widgetProps} />;
            case "spatial-profiler-settings":
                return <SpatialProfilerSettingsPanelComponent {...widgetProps} />;
            case "spectral-profiler-settings":
                return <SpectralProfilerSettingsPanelComponent {...widgetProps} />;
            case "stokes-settings":
                return <StokesAnalysisSettingsPanelComponent {...widgetProps} />;
            case "catalog-overlay-settings":
                return <CatalogOverlayPlotSettingsPanelComponent {...widgetProps} />;
            default:
                return <PlaceholderComponent id={id} label="Unknown Widget" docked={docked} />;
        }
    };

    private onAction = (action: FlexLayout.Action): FlexLayout.Action | undefined => {
        // Handle actions like tab creation, deletion, etc.
        console.log("FlexLayout action:", action.type, action);
        
        // For now, just log actions. Widget management will be handled differently in FlexLayout
        return action;
    };

    private onRenderTab = (node: FlexLayout.TabNode, renderValues: FlexLayout.ITabRenderValues) => {
        // Customize tab rendering with Blueprint.js components
        const config = node.getConfig();
        const component = node.getComponent();
        
        // Add test IDs for automated testing
        if (config?.id) {
            renderValues.content = (
                <div data-testid={`${config.id}-header-title`} className="flexlayout-tab-content">
                    {component === "image-view"}
                    {component === "histogram"}
                    {component === "spatial-profiler"}
                    {component === "spectral-profiler"}
                    <span className="tab-title">{renderValues.content}</span>
                </div>
            );
        }
    };

    private onRenderTabSet = (node: FlexLayout.TabSetNode, renderValues: FlexLayout.ITabSetRenderValues) => {
        // Customize tabset rendering (add buttons, etc.)
        // This is where we can add the settings, help, unpin buttons similar to GoldenLayout
        
        // Add custom buttons to the tab bar
        const activeTab = node.getSelectedNode();
        if (activeTab && activeTab.getType() === "tab") {
            const tabNode = activeTab as FlexLayout.TabNode;
            const component = tabNode.getComponent();
            const showCogWidgets = ["image-view", "spatial-profiler", "spectral-profiler", "histogram", "render-config", "stokes", "catalog-overlay", "layer-list"];
            const hideHelpButtonWidgets = ["pv-preview"];
            
            if (!component) return;
            
            const buttons: React.ReactNode[] = [];
            
            // Settings button
            if (showCogWidgets.includes(component)) {
                buttons.push(
                    <Tooltip key="settings" content="Settings" position={Position.BOTTOM}>
                        <Button 
                            minimal
                            small
                            icon="cog"
                            className="floating-header-button"
                            onClick={() => this.onSettingsClick(tabNode)}
                            data-testid={`${tabNode.getConfig()?.id}-settings-button`}
                        />
                    </Tooltip>
                );
            }
            
            // Help button
            if (!hideHelpButtonWidgets.includes(component)) {
                buttons.push(
                    <Tooltip key="help" content="Help" position={Position.BOTTOM}>
                        <Button 
                            minimal
                            small
                            icon="help"
                            className="floating-header-button"
                            onClick={() => this.onHelpClick(tabNode)}
                            data-testid={`${tabNode.getConfig()?.id}-help-button`}
                        />
                    </Tooltip>
                );
            }
            
            // Unpin/Float button (equivalent to GoldenLayout's unpin)
            buttons.push(
                <Tooltip key="unpin" content="Float this widget" position={Position.BOTTOM}>
                    <Button 
                        minimal
                        small
                        icon="unpin"
                        className="floating-header-button"
                        onClick={() => this.onUnpinClick(tabNode)}
                        data-testid={`${tabNode.getConfig()?.id}-unpin-button`}
                    />
                </Tooltip>
            );
            
            // Add buttons to toolbar if any
            if (buttons.length > 0) {
                renderValues.buttons = buttons;
            }
        }
    };

    private onSettingsClick = (node: FlexLayout.TabNode) => {
        console.log("Settings clicked for:", node.getComponent());
        
        const component = node.getComponent();
        const config = node.getConfig();
        const id = config?.id || node.getId();
        const title = node.getName();
        
        if (!component) {
            console.warn("No component type found for node:", node.getId());
            return;
        }
        
        // Check if this widget type supports settings
        const floatingSettingsAppliedWidgets = [
            "image-view",
            "stokes", 
            "spectral-profiler",
            "spatial-profiler", 
            "render-config",
            "histogram",
            "catalog-overlay",
            "layer-list"
        ];
        
        if (!floatingSettingsAppliedWidgets.includes(component)) {
            console.warn("Settings not supported for component type:", component);
            return;
        }
        
        // Use WidgetsStore to create the floating settings widget
        const widgetsStore = WidgetsStore.Instance;
        const settingsTitle = component === "image-view" ? "Image View Settings" : `${title} Settings`;
        
        try {
            widgetsStore.createFloatingSettingsWidget(settingsTitle, id, component);
        } catch (error) {
            console.error("Failed to create floating settings widget:", error);
        }
    };

    private onHelpClick = (node: FlexLayout.TabNode) => {
        console.log("Help clicked for:", node.getComponent());
        
        const component = node.getComponent();
        const config = node.getConfig();
        const id = config?.id || node.getId();
        
        if (!component) {
            console.warn("No component type found for node:", node.getId());
            return;
        }
        
        // Get widget config from component type
        const widgetConfig = this.getWidgetConfigFromComponent(component);
        if (!widgetConfig) {
            console.warn("Unknown component type:", component);
            return;
        }
        
        // Calculate center position for help drawer
        let centerX = 0;
        // In FlexLayout, we don't have direct access to container width like in GoldenLayout
        // We'll use a default center position or try to get it from the element
        try {
            const tabElement = document.querySelector(`[data-tabid="${node.getId()}"]`);
            if (tabElement) {
                const rect = tabElement.getBoundingClientRect();
                centerX = rect.right - rect.width * 0.5;
            }
        } catch (error) {
            console.warn("Could not calculate help drawer position:", error);
        }
        
        if (widgetConfig.helpType && !Array.isArray(widgetConfig.helpType)) {
            HelpStore.Instance.showHelpDrawer(widgetConfig.helpType, centerX);
        } else {
            const widgetsStore = WidgetsStore.Instance;
            
            // Handle catalog plot widgets
            const catalogPlotWidgetStore = widgetsStore.catalogPlotWidgets.get(id);
            if (catalogPlotWidgetStore) {
                HelpStore.Instance.showHelpDrawer(
                    catalogPlotWidgetStore.plotType === CatalogPlotType.Histogram 
                        ? HelpType.CATALOG_HISTOGRAM_PLOT 
                        : HelpType.CATALOG_SCATTER_PLOT, 
                    centerX
                );
                return;
            }
            
            // Handle render config widgets
            const renderConfigWidgetStore = widgetsStore.renderConfigWidgets.get(id);
            if (renderConfigWidgetStore) {
                HelpStore.Instance.showHelpDrawer(
                    AppStore.Instance.activeImage?.type === ImageType.COLOR_BLENDING 
                        ? HelpType.RENDER_CONFIG_COLOR_BLENDING 
                        : HelpType.RENDER_CONFIG, 
                    centerX
                );
                return;
            }
            
            // If no specific help type, try to show default help for the widget type
            if (widgetConfig.helpType) {
                const helpType = Array.isArray(widgetConfig.helpType) ? widgetConfig.helpType[0] : widgetConfig.helpType;
                HelpStore.Instance.showHelpDrawer(helpType, centerX);
            }
        }
    };

    private onUnpinClick = (node: FlexLayout.TabNode) => {
        console.log("Unpin clicked for:", node.getComponent());
        
        const component = node.getComponent();
        const config = node.getConfig();
        const id = config?.id || node.getId();
        const title = node.getName();
        
        if (!component) {
            console.warn("No component type found for node:", node.getId());
            return;
        }
        
        // Avoid floating ImageViewComponent (similar to GoldenLayout behavior)
        if (component === "image-view") {
            console.warn("Cannot float image-view component");
            return;
        }
        
        // Get widget config from component type
        const widgetConfig = this.getWidgetConfigFromComponent(component);
        if (!widgetConfig) {
            console.warn("Unknown component type:", component);
            return;
        }
        
        // Create a new WidgetConfig for the floating widget
        const floatingWidgetConfig = new WidgetConfig(id, widgetConfig);
        floatingWidgetConfig.title = title;
        
        // Handle special cases
        if (component === "catalog-overlay") {
            floatingWidgetConfig.componentId = id;
        }
        
        if (component === "pv-preview") {
            floatingWidgetConfig.parentId = config?.id;
            floatingWidgetConfig.parentType = PvPreviewComponent.WIDGET_CONFIG.parentType;
        }
        
        // Handle catalog plot help types
        const widgetsStore = WidgetsStore.Instance;
        const catalogPlotWidgetStore = widgetsStore.catalogPlotWidgets.get(id);
        if (catalogPlotWidgetStore) {
            floatingWidgetConfig.helpType = catalogPlotWidgetStore.plotType === CatalogPlotType.Histogram 
                ? HelpType.CATALOG_HISTOGRAM_PLOT 
                : HelpType.CATALOG_SCATTER_PLOT;
        }
        
        // Try to get the current tab's dimensions and position for floating widget
        try {
            const tabElement = document.querySelector(`[data-tabid="${node.getId()}"]`);
            const tabsetElement = tabElement?.closest('.flexlayout__tabset_content');
            
            if (tabsetElement) {
                const rect = tabsetElement.getBoundingClientRect();
                // Snap size to grid (25px grid)
                const width = Math.round(rect.width / 25.0) * 25;
                const height = Math.round(rect.height / 25.0) * 25;
                floatingWidgetConfig.setDefaultSize(width, height);
                
                // Snap position to grid and adjust for title and container offset
                const x = Math.round(rect.left / 25.0) * 25 + 5;
                const y = Math.round(rect.top / 25.0) * 25 - 25;
                floatingWidgetConfig.setDefaultPosition(x, y);
            }
        } catch (error) {
            console.warn("Could not determine tab dimensions, using defaults:", error);
            // Use default floating widget offset if we can't determine size/position
            const offset = 100 + (widgetsStore.floatingWidgets.length * 25) % 300;
            floatingWidgetConfig.setDefaultPosition(offset, offset);
        }
        
        // Add the floating widget to the widgets store
        widgetsStore.addFloatingWidget(floatingWidgetConfig);
        
        // Remove the tab from FlexLayout
        const flexLayoutStore = FlexLayoutStore.Instance;
        if (flexLayoutStore.model) {
            const deleteAction = FlexLayout.Actions.deleteTab(node.getId());
            flexLayoutStore.model.doAction(deleteAction);
        }
    };

    public render() {
        const flexLayoutStore = FlexLayoutStore.Instance;
        // const {darkTheme} = this.props;
        
        if (!flexLayoutStore.model) {
            return <div>Loading layout...</div>;
        }

        const className = classNames("flex-layout-container", {
            "dark-theme": AppStore.Instance.darkTheme,
            [Classes.DARK]: AppStore.Instance.darkTheme
        });

        return (
            <div className={className}>
                <FlexLayout.Layout 
                    model={flexLayoutStore.model}
                    factory={this.factory}
                    onAction={this.onAction}
                    onRenderTab={this.onRenderTab}
                    onRenderTabSet={this.onRenderTabSet}
                />
            </div>
        );
    }
}