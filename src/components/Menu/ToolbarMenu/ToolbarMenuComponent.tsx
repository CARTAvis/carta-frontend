import * as React from "react";
import {observer} from "mobx-react";
import {Button, ButtonGroup, Icon, Tooltip, AnchorButton} from "@blueprintjs/core";
import {AppStore, WidgetConfig, RegionMode} from "stores";
import {
    AnimatorComponent,
    HistogramComponent,
    LayerListComponent,
    LogComponent,
    RegionListComponent,
    RenderConfigComponent,
    SpatialProfilerComponent,
    SpectralProfilerComponent,
    SpectralLineQueryComponent,
    StatsComponent,
    StokesAnalysisComponent,
    CatalogOverlayComponent,
    ImageViewLayer
} from "components";
import {RegionCreationMode} from "models";
import {CustomIcon} from "icons/CustomIcons";
import {CARTA} from "carta-protobuf";
import "./ToolbarMenuComponent.scss";

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
            ["spectralLineQueryButton", SpectralLineQueryComponent.WIDGET_CONFIG],
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

    regionTooltip = (shape: string) => {
        const regionModeIsCenter = AppStore.Instance.preferenceStore.regionCreationMode === RegionCreationMode.CENTER;
        return (
            <span><br/><i><small>
                Click-and-drag to define a region ({regionModeIsCenter ? "center to corner" : "corner to corner"}).<br/>
                Hold Ctrl to define a region ({regionModeIsCenter ? "corner to corner" : "center to corner"}).<br/>
                Change the default creation mode in Preferences.<br/>
                Hold shift key to create a {shape}.
            </small></i></span>
        );
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
                <ButtonGroup className={actionsClassName}>
                    <Tooltip content={<span>Point</span>}>
                        <AnchorButton icon={"symbol-square"} onClick={() => this.handleRegionTypeClicked(CARTA.RegionType.POINT)} active={isRegionCreating && newRegionType === CARTA.RegionType.POINT} disabled={regionButtonsDisabled}/>
                    </Tooltip>
                    <Tooltip content={<span>Rectangle{this.regionTooltip("square")}</span>}>
                        <AnchorButton icon={"square"} onClick={() => this.handleRegionTypeClicked(CARTA.RegionType.RECTANGLE)} active={isRegionCreating && newRegionType === CARTA.RegionType.RECTANGLE} disabled={regionButtonsDisabled}/>
                    </Tooltip>
                    <Tooltip content={<span>Ellipse{this.regionTooltip("circle")}</span>}>
                        <AnchorButton icon={"circle"} onClick={() => this.handleRegionTypeClicked(CARTA.RegionType.ELLIPSE)} active={isRegionCreating && newRegionType === CARTA.RegionType.ELLIPSE} disabled={regionButtonsDisabled}/>
                    </Tooltip>
                    <Tooltip
                        content={
                            <span>Polygon<span><br/><i><small>Define control points with a series of clicks.<br/>
                            Double-click to close the loop and finish polygon creation.<br/>
                            Double-click on a control point to delete it.<br/>
                            Click on a side to create a new control point.</small></i></span></span>
                        }
                    >
                        <AnchorButton icon={"polygon-filter"} onClick={() => this.handleRegionTypeClicked(CARTA.RegionType.POLYGON)} active={isRegionCreating && newRegionType === CARTA.RegionType.POLYGON} disabled={regionButtonsDisabled}/>
                    </Tooltip>
                </ButtonGroup>
                <ButtonGroup className={className}>
                    <Tooltip content={<span>Region List Widget{commonTooltip}</span>}>
                        <Button icon={<CustomIcon icon={"regionList"}/>} id="regionListButton" onClick={appStore.widgetsStore.createFloatingRegionListWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Log Widget{commonTooltip}</span>}>
                        <Button icon={"application"} id="logButton" onClick={appStore.widgetsStore.createFloatingLogWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Spatial Profiler{commonTooltip}</span>}>
                        <Button icon={<CustomIcon icon={"spatialProfiler"}/>} id="spatialProfilerButton" onClick={appStore.widgetsStore.createFloatingSpatialProfilerWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Spectral Profiler{commonTooltip}</span>}>
                        <Button icon={<CustomIcon icon={"spectralProfiler"}/>} id="spectralProfilerButton" onClick={appStore.widgetsStore.createFloatingSpectralProfilerWidget}/>
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
                        <Button icon={<CustomIcon icon={"stokes"}/>} id="stokesAnalysisButton" onClick={appStore.widgetsStore.createFloatingStokesWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Image List Widget{commonTooltip}</span>}>
                        <Button icon={"layers"} id="layerListButton" onClick={appStore.widgetsStore.createFloatingLayerListWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Catalog Widget{commonTooltip}</span>}>
                        <Button icon={"heatmap"} id="catalogOverlayButton" onClick={appStore.widgetsStore.reloadFloatingCatalogWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Spectral Line Query Widget{commonTooltip}</span>}>
                        <Button icon={<CustomIcon icon={"spectralLineQuery"}/>} id="spectralLineQueryButton" onClick={appStore.widgetsStore.createFloatingSpectralLineQueryWidget}/>
                    </Tooltip>
                </ButtonGroup>
                <ButtonGroup className={dialogClassName}>
                    <Tooltip content={<span>File Header</span>}>
                        <Button icon={"app-header"} onClick={dialogStore.showFileInfoDialog} active={dialogStore.fileInfoDialogVisible}/>
                    </Tooltip>
                    <Tooltip content={<span>Preferences</span>}>
                        <Button icon={"wrench"} onClick={dialogStore.showPreferenceDialog} active={dialogStore.preferenceDialogVisible}/>
                    </Tooltip>
                    <Tooltip content={<span>Contours</span>}>
                        <Button icon={<CustomIcon icon={"contour"}/>} onClick={dialogStore.showContourDialog} active={dialogStore.contourDialogVisible}/>
                    </Tooltip>
                </ButtonGroup>
            </React.Fragment>
        );
    }
}