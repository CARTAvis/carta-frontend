import * as React from "react";
import {observer} from "mobx-react";
import {Button, ButtonGroup, Tooltip, AnchorButton} from "@blueprintjs/core";
import {AppStore, DialogStore, WidgetConfig, RegionMode} from "stores";
import {
    AnimatorComponent, 
    HistogramComponent, 
    LayerListComponent, 
    LogComponent, 
    RegionListComponent, 
    RenderConfigComponent, 
    SpatialProfilerComponent, 
    SpectralProfilerComponent, 
    StatsComponent, 
    StokesAnalysisComponent, 
    CatalogOverlayComponent,
    ImageViewLayer
} from "components";
import {CustomIcon} from "icons/CustomIcons";
import {CARTA} from "carta-protobuf";
import "./ToolbarMenuComponent.css";
@observer
export class ToolbarMenuComponent extends React.Component {
    public static get DRAGSOURCE_WIDGETCONFIG_MAP(): Map<string, WidgetConfig> {
        return new Map<string, WidgetConfig>([
            ["renderConfigButton", RenderConfigComponent.WIDGET_CONFIG],
            ["layerListButton", LayerListComponent.WIDGET_CONFIG],
            ["logButton", LogComponent.WIDGET_CONFIG],
            ["animatorButton", AnimatorComponent.WIDGET_CONFIG],
            ["regionListButton", RegionListComponent.WIDGET_CONFIG],
            ["spatialProfilerButton", SpatialProfilerComponent.WIDGET_CONFIG],
            ["spectralProfilerButton", SpectralProfilerComponent.WIDGET_CONFIG],
            ["statsButton", StatsComponent.WIDGET_CONFIG],
            ["histogramButton", HistogramComponent.WIDGET_CONFIG],
            ["stokesAnalysisButton", StokesAnalysisComponent.WIDGET_CONFIG],
            ["catalogOverlayButton", CatalogOverlayComponent.WIDGET_CONFIG]
        ]);
    }

    handleRegionTypeClicked = (type: CARTA.RegionType) => {
        const appStore = AppStore.Instance;
        appStore.activeFrame.regionSet.setNewRegionType(type);
        appStore.activeFrame.regionSet.setMode(RegionMode.CREATING);
    };

    public render() {
        const appStore = AppStore.Instance;
        const dialogStore = appStore.dialogStore;

        let className = "toolbar-menu";
        let dialogClassName = "dialog-toolbar-menu";
        let actionsClassName = "actions-toolbar-menu";
        if (appStore.darkTheme) {
            className += " bp3-dark";
            dialogClassName += " bp3-dark";
            actionsClassName += " bp3-dark";
        }
        const isRegionCreating = appStore.activeFrame ? appStore.activeFrame.regionSet.mode === RegionMode.CREATING : false;
        const newRegionType = appStore.activeFrame ? appStore.activeFrame.regionSet.newRegionType : CARTA.RegionType.RECTANGLE;
        const regionButtonsDisabled = !appStore.activeFrame || appStore.activeLayer === ImageViewLayer.Catalog;

        const commonTooltip = <span><br/><i><small>Drag to place docked widget<br/>Click to place a floating widget</small></i></span>;
        return (
            <React.Fragment>
                <ButtonGroup className={className}>
                    <Tooltip content={<span>Region List Widget{commonTooltip}</span>}>
                        <Button icon={"th-list"} id="regionListButton" onClick={appStore.widgetsStore.createFloatingRegionListWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Log Widget{commonTooltip}</span>}>
                        <Button icon={"application"} id="logButton" onClick={appStore.widgetsStore.createFloatingLogWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Spatial Profiler{commonTooltip}</span>}>
                        <Button icon={"pulse"} id="spatialProfilerButton" className={"profiler-button"} onClick={appStore.widgetsStore.createFloatingSpatialProfilerWidget}>
                            xy
                        </Button>
                    </Tooltip>
                    <Tooltip content={<span>Spectral Profiler{commonTooltip}</span>}>
                        <Button icon={"pulse"} id="spectralProfilerButton" className={"profiler-button"} onClick={appStore.widgetsStore.createFloatingSpectralProfilerWidget}>
                            &nbsp;z
                        </Button>
                    </Tooltip>
                    <Tooltip content={<span>Statistics Widget{commonTooltip}</span>}>
                        <Button icon={"calculator"} id="statsButton" onClick={appStore.widgetsStore.createFloatingStatsWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Histogram Widget{commonTooltip}</span>}>
                        <Button icon={"timeline-bar-chart"} id="histogramButton" onClick={appStore.widgetsStore.createFloatingHistogramWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Animator Widget{commonTooltip}</span>}>
                        <Button icon={"video"} id="animatorButton" onClick={appStore.widgetsStore.createFloatingAnimatorWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Render Config Widget{commonTooltip}</span>}>
                        <Button icon={"style"} id="renderConfigButton" onClick={appStore.widgetsStore.createFloatingRenderWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Stokes Analysis Widget{commonTooltip}</span>}>
                        <Button icon={"pulse"} id="stokesAnalysisButton" className={"profiler-button"} onClick={appStore.widgetsStore.createFloatingStokesWidget}>
                            &nbsp;s
                        </Button>
                    </Tooltip>
                    <Tooltip content={<span>Layer List Widget{commonTooltip}</span>}>
                        <Button icon={"layers"} id="layerListButton" onClick={appStore.widgetsStore.createFloatingLayerListWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Catalog Widget{commonTooltip}</span>}>
                        <Button icon={"heatmap"} id="catalogOverlayButton" onClick={appStore.widgetsStore.reloadFloatingCatalogOverlayWidget}/>
                    </Tooltip>
                </ButtonGroup>
                <ButtonGroup className={dialogClassName}>
                    <Tooltip content={<span>File Info</span>}>
                        <Button icon={"info-sign"} onClick={dialogStore.showFileInfoDialog} active={dialogStore.fileInfoDialogVisible}/>
                    </Tooltip>
                    <Tooltip content={<span>Preference</span>}>
                        <Button icon={"properties"} onClick={dialogStore.showPreferenceDialog} active={dialogStore.preferenceDialogVisible}/>
                    </Tooltip>
                    <Tooltip content={<span>Overlay Settings</span>}>
                        <Button icon={"settings"} onClick={dialogStore.showOverlaySettings} active={dialogStore.overlaySettingsDialogVisible}/>
                    </Tooltip>
                    <Tooltip content={<span>Contours</span>}>
                        <Button icon={<CustomIcon icon={"contour"}/>} onClick={dialogStore.showContourDialog} active={dialogStore.contourDialogVisible}/>
                    </Tooltip>
                </ButtonGroup>
                <ButtonGroup className={actionsClassName}>
                    <Tooltip content={<span>Point</span>}>
                        <AnchorButton icon={"symbol-square"} onClick={() => this.handleRegionTypeClicked(CARTA.RegionType.POINT)} active={isRegionCreating && newRegionType === CARTA.RegionType.POINT} disabled={regionButtonsDisabled}/>
                    </Tooltip>
                    <Tooltip content={<span>Rectangle</span>}>
                        <AnchorButton icon={"square"} onClick={() => this.handleRegionTypeClicked(CARTA.RegionType.RECTANGLE)} active={isRegionCreating && newRegionType === CARTA.RegionType.RECTANGLE} disabled={regionButtonsDisabled}/>
                    </Tooltip>
                    <Tooltip content={<span>Ellipse</span>}>
                        <AnchorButton icon={"circle"} onClick={() => this.handleRegionTypeClicked(CARTA.RegionType.ELLIPSE)} active={isRegionCreating && newRegionType === CARTA.RegionType.ELLIPSE} disabled={regionButtonsDisabled}/>
                    </Tooltip>
                    <Tooltip content={<span>Polygon</span>}>
                        <AnchorButton icon={"polygon-filter"} onClick={() => this.handleRegionTypeClicked(CARTA.RegionType.POLYGON)} active={isRegionCreating && newRegionType === CARTA.RegionType.POLYGON} disabled={regionButtonsDisabled}/>
                    </Tooltip>
                </ButtonGroup>
            </React.Fragment>
        );
    }
}