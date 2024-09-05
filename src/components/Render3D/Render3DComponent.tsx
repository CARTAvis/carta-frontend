import * as React from "react";
// import ReactResizeDetector from "react-resize-detector";
import {Divider, FormGroup, HTMLSelect, Tab, Tabs} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react"; 

// import {TaskProgressDialogComponent} from "components/Dialogs";
import {LinePlotComponent, LinePlotComponentProps} from "components/Shared";
import {Point2D} from "models";
import {AppStore, DefaultWidgetConfig, HelpType, WidgetProps, WidgetsStore} from "stores";
// import {FrameStore} from "stores/Frame";
import {RegionId, Render3DWidgetStore} from "stores/Widgets";
import {clamp, getColorForTheme} from "utilities";

// import {MultiPlotProps, TickType} from "../Shared/LinePlot/PlotContainer/PlotContainerComponent";
import "./Render3DComponent.scss";

enum Render3DTabs {
    IsoSurfaces,
    Volume
}

enum IsoSurfaceTabs {
    Levels = "levels",
    Configuration = "configuration",
    Styling = "styling"
}


@observer
export class Render3DComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "render-3d",
            type: "render-3d",
            minWidth: 425,
            minHeight: 450,
            defaultWidth: 600,
            defaultHeight: 700,
            title: "3D Rendering",
            isCloseable: true,
            helpType: HelpType.RENDER_3D
        };
    }

    @observable levels: number[];

    // find widgetStore for render 3d
    @computed get widgetStore(): Render3DWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.render3DWidgets) {
            const widgetStore = widgetsStore.render3DWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new Render3DWidgetStore();
    }

    // return header with region properties
    @computed get exportHeader(): string[] {
        const headerString: string[] = [];
        if (this.widgetStore.effectiveRegion) {
            headerString.push(...this.widgetStore.effectiveFrame.getRegionProperties(this.widgetStore.effectiveRegionId));
        }
        return headerString;
    }

    @computed get histogramData(): CARTA.IHistogram {
        alert("histogram data accessed");
        const regionHistogramData = this.getRegionHistogramData();
        return regionHistogramData ? regionHistogramData.histograms : null;
    }

    @computed get plotData(): {values: Array<Point2D>; xMin: number; xMax: number; yMin: number; yMax: number} {
        const histogram = this.histogramData;
        if (histogram) {
            alert("histogram data is not null");
            let minIndex = 0;
            let maxIndex = histogram.bins.length - 1;

            // Truncate array if zoomed in (sidestepping ChartJS bug with off-canvas rendering and speeding up layout)
            if (!this.widgetStore.isAutoScaledX) {
                minIndex = Math.floor((this.widgetStore.minX - histogram.firstBinCenter) / histogram.binWidth);
                minIndex = clamp(minIndex, 0, histogram.bins.length - 1);
                maxIndex = Math.ceil((this.widgetStore.maxX - histogram.firstBinCenter) / histogram.binWidth);
                maxIndex = clamp(maxIndex, 0, histogram.bins.length - 1);
            }

            let xMin = histogram.firstBinCenter + histogram.binWidth * minIndex;
            let xMax = histogram.firstBinCenter + histogram.binWidth * maxIndex;
            let yMin = histogram.bins[minIndex];
            let yMax = yMin;

            let values: Array<{x: number; y: number}>;
            const N = maxIndex - minIndex;
            if (N > 0 && !isNaN(N)) {
                values = new Array(maxIndex - minIndex);

                for (let i = minIndex; i <= maxIndex; i++) {
                    values[i - minIndex] = {x: histogram.firstBinCenter + histogram.binWidth * i, y: histogram.bins[i]};
                    yMin = Math.min(yMin, histogram.bins[i]);
                    yMax = Math.max(yMax, histogram.bins[i]);
                }
            }
            return {values, xMin, xMax, yMin, yMax};
        }
        return null;
    }

    
    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        const appStore = AppStore.Instance;
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === Render3DComponent.WIDGET_CONFIG.type) {
            // Assign the next unique ID
            const id = appStore.widgetsStore.addRender3DWidget();
            appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!appStore.widgetsStore.render3DWidgets.has(this.props.id)) {
                console.log(`can't find store for widget with id=${this.props.id}`);
                appStore.widgetsStore.render3DWidgets.set(this.props.id, new Render3DWidgetStore());
            }
        }
    }

    // handle changing the data source
    private handleFrameChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        if (this.widgetStore.effectiveFrame) {
            alert("frame changed");
            const selectedFileId = parseInt(changeEvent.target.value);
            this.widgetStore.setFileId(selectedFileId);
            this.widgetStore.setRegionId(this.widgetStore.effectiveFrame.frameInfo.fileId, RegionId.NONE);
        }
    };

    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        if (this.widgetStore.effectiveFrame) {
            const fileId = this.widgetStore.effectiveFrame.frameInfo.fileId;
            this.widgetStore.setFileId(fileId);
            this.widgetStore.setRegionId(fileId, parseInt(changeEvent.target.value));
        }
    };

    // private handleGraphClicked = (x: number) => {
    //     this.levels.push(x);
    //     this.levels.sort((a, b) => a - b);
    // };

    // private handleGraphRightClicked = (x: number) => {
    //     let closestIndex = -1;
    //     let minDistance = Number.MAX_VALUE;

    private getRegionHistogramData = (): CARTA.IRegionHistogramData => {
        if (!this.widgetStore.effectiveFrame) {
            return null;
        }

        const fileId = this.widgetStore.effectiveFrame.frameInfo.fileId;
        const regionId = this.widgetStore.effectiveRegionId;
        const coordinate = this.widgetStore.coordinate;
        const appStore = AppStore.Instance;

        alert('effectiveframe')
        alert(fileId)
        alert('----')
        alert(regionId)

        const frameMap = appStore.regionHistograms.get(fileId);
        if (!frameMap) {
            return null;
        }

        alert(frameMap)

        const regionMap = frameMap.get(regionId);
        if (!regionMap) {
            alert('effectiveframe2')
            return null;
        }

        const stokesIndex = this.widgetStore.effectiveFrame.polarizationInfo.findIndex(polarization => polarization.replace("Stokes ", "") === coordinate.slice(0, coordinate.length - 1));
        const stokes = stokesIndex >= this.widgetStore.effectiveFrame.frameInfo.fileInfoExtended.stokes ? this.widgetStore.effectiveFrame.polarizations[stokesIndex] : stokesIndex;
        const regionHistogramData = regionMap.get(stokes === -1 ? this.widgetStore.effectiveFrame.requiredStokes : stokes);

        return regionHistogramData ? regionHistogramData : null;
    };

    render() {
        const appStore = AppStore.Instance;
        const frame = this.widgetStore.effectiveFrame;
        const fileInfo = frame ? `${appStore.getFrameIndex(frame.frameInfo.fileId)}: ${frame.filename}` : undefined;
        const regionInfo = this.widgetStore.effectiveRegionInfo;

        let selectedValue = RegionId.NONE;
        if (this.widgetStore.effectiveFrame?.regionSet) {
            selectedValue = this.widgetStore.regionIdMap.get(this.widgetStore.effectiveFrame.frameInfo.fileId);
        }

        let unitString = "Value";
        if (frame.headerUnit) {
            unitString = `Value (${frame.headerUnit})`;
        }

        const linePlotProps: LinePlotComponentProps = {
            xLabel: unitString,
            darkMode: appStore.darkTheme,
            logY: this.widgetStore.logScaleY,
            plotType: this.widgetStore.plotType,
            showYAxisTicks: false,
            showYAxisLabel: false,
            // graphClicked: this.handleGraphClicked,
            // graphRightClicked: this.handleGraphRightClicked,
            graphZoomedX: this.widgetStore.setXBounds,
            graphZoomedY: this.widgetStore.setYBounds,
            graphZoomedXY: this.widgetStore.setXYBounds,
            graphZoomReset: this.widgetStore.clearXYBounds,
            scrollZoom: true,
            borderWidth: this.widgetStore.lineWidth,
            pointRadius: this.widgetStore.linePlotPointSize,
            zeroLineWidth: 2
        };

        const currentPlotData = this.plotData;
        if (currentPlotData) {
            // set line color
            let primaryLineColor = getColorForTheme(this.widgetStore.primaryLineColor);
            linePlotProps.lineColor = primaryLineColor;

            // Determine scale in X and Y directions. If auto-scaling, use the bounds of the current data
            if (this.widgetStore.isAutoScaledX) {
                const minVal = Math.min(currentPlotData.xMin, ...this.levels);
                const maxVal = Math.max(currentPlotData.xMax, ...this.levels);
                const xRange = maxVal - minVal;
                linePlotProps.xMin = minVal - 0.01 * xRange;
                linePlotProps.xMax = maxVal + 0.01 * xRange;
            } else {
                linePlotProps.xMin = this.widgetStore.minX;
                linePlotProps.xMax = this.widgetStore.maxX;
            }

            if (this.widgetStore.isAutoScaledY) {
                linePlotProps.yMin = currentPlotData.yMin;
                linePlotProps.yMax = currentPlotData.yMax;
            } else {
                linePlotProps.yMin = this.widgetStore.minY;
                linePlotProps.yMax = this.widgetStore.maxY;
            }
            // Fix log plot min bounds for entries with zeros in them
            if (this.widgetStore.logScaleY && linePlotProps.yMin <= 0) {
                linePlotProps.yMin = 0.5;
            }

            linePlotProps.data = currentPlotData.values;
        }

        const isoSurfacesLevelsPanel = (
            <div className="histogram-plot">
                <LinePlotComponent {...linePlotProps} />
            </div>
        );

        const isoSurfacesConfigurationPanel = (
            <div>configuration</div>
        );

        const isoSurfacesStylingPanel = (
            <div>styling</div>
        );

        const isoSurfacesPanel = (
            <div>
                <Tabs defaultSelectedTabId={IsoSurfaceTabs.Levels} renderActiveTabPanelOnly={false}>
                    <Tab id={IsoSurfaceTabs.Levels} title="Levels" panel={isoSurfacesLevelsPanel} panelClassName="render-3d-isosurfaces-levels-panel" data-testid="render-3d-isosurfaces-levels-tab-title" />
                    <Tab id={IsoSurfaceTabs.Configuration} title="Configuration" panel={isoSurfacesConfigurationPanel} panelClassName="render-3d-isosurfaces-configuration-panel" data-testid="render-3d-isosurfaces-configuration-tab-title" />
                    <Tab id={IsoSurfaceTabs.Styling} title="Styling" panel={isoSurfacesStylingPanel} panelClassName="render-3d-isosurfaces-styling-panel" data-testid="render-3d-isosurfaces-styling-tab-title" />
                </Tabs>
            </div>
        );

        const volumePanel = (
            <div>volume</div>
        );


        return (
            <div className="render-3d-widget">
                <div className="render-3d-panel">
                <FormGroup
                    className="label-info-group"
                    inline={true}
                    label="Data source"
                    labelInfo={
                        <span className="label-info" title={fileInfo}>
                            {fileInfo ? `(${fileInfo})` : ""}
                        </span>
                    }
                >
                    <HTMLSelect value={this.widgetStore.fileId} options={this.widgetStore.frameOptions} onChange={this.handleFrameChanged} data-testid="render-3d-image-dropdown" />
                </FormGroup>
                <FormGroup
                    className="label-info-group"
                    inline={true}
                    label="Region"
                    labelInfo={
                        <span className="label-info" title={regionInfo}>
                            {regionInfo ? `(${regionInfo})` : ""}
                        </span>
                    }
                >
                    <HTMLSelect value={selectedValue} options={this.widgetStore.regionOptions} onChange={this.handleRegionChanged} data-testid="render-3d-region-dropdown" />
                </FormGroup>
                <Divider />
                <Tabs defaultSelectedTabId={Render3DTabs.IsoSurfaces} renderActiveTabPanelOnly={false}>
                        <Tab id={Render3DTabs.IsoSurfaces} title="Iso-surfaces" panel={isoSurfacesPanel} panelClassName="render-3d-isosurfaces-panel" data-testid="render-3d-isosurfaces-tab-title" />
                        <Tab id={Render3DTabs.Volume} title="Volume rendering" panel={volumePanel} panelClassName="render-3d-volume-panel" data-testid="render-3d-volume-tab-title" />
                    </Tabs>
                </div>
            </div>
        );
    }

} // end class Render3DComponent
