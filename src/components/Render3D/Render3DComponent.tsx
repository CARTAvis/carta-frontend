import * as React from "react";
// import ReactResizeDetector from "react-resize-detector";
import {Divider, FormGroup, HTMLSelect, NonIdealState, Tab, Tabs} from "@blueprintjs/core";
// import {CARTA} from "carta-protobuf";
import * as _ from "lodash";
import {action, computed, makeObservable, observable} from "mobx";
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

    @observable width: number;
    @observable height: number;

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

    @computed get plotData(): {values: Array<Point2D>; xMin: number; xMax: number; yMin: number; yMax: number} {
        const widgetStore = this.widgetStore;
        const frame = widgetStore.effectiveFrame;
        if (frame && frame.renderConfig.histogram && frame.renderConfig.histogram.bins && frame.renderConfig.histogram.bins.length) {
            const histogram = frame.renderConfig.histogram;
            alert("histogram: " + histogram);
            let minIndex = 0;
            let maxIndex = histogram.bins.length - 1;

            // Truncate array if zoomed in (sidestepping ChartJS bug with off-canvas rendering and speeding up layout)
            if (!widgetStore.isAutoScaledX) {
                minIndex = Math.floor((widgetStore.minX - histogram.firstBinCenter) / histogram.binWidth);
                minIndex = clamp(minIndex, 0, histogram.bins.length - 1);
                maxIndex = Math.ceil((widgetStore.maxX - histogram.firstBinCenter) / histogram.binWidth);
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

    @action onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    onGraphCursorMoved = _.throttle(x => {
        this.widgetStore.setCursor(x);
    }, 100);

    render() {
        const appStore = AppStore.Instance;
        const frame = this.widgetStore.effectiveFrame;
        const fileInfo = frame ? `${appStore.getFrameIndex(frame.frameInfo.fileId)}: ${frame.filename}` : undefined;
        const regionInfo = this.widgetStore.effectiveRegionInfo;

        let selectedValue = RegionId.NONE;
        if (this.widgetStore.effectiveFrame?.regionSet) {
            selectedValue = this.widgetStore.regionIdMap.get(this.widgetStore.effectiveFrame.frameInfo.fileId);
        }

        // here
        if (!frame || !this.widgetStore) {
            return (
                <div className="isosurface-panel">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                </div>
            );
        }

        let unit = "";
        if (frame && frame.headerUnit) {
            unit = frame.headerUnit;
        }

        let linePlotProps: LinePlotComponentProps = {
            xLabel: unit ? `Value (${unit})` : "Value",
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
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true,
            borderWidth: this.widgetStore.lineWidth,
            pointRadius: this.widgetStore.linePlotPointSize,
            zeroLineWidth: 2
        }

        if (frame.renderConfig.histogram && frame.renderConfig.histogram.bins && frame.renderConfig.histogram.bins.length) {
            const currentPlotData = this.plotData;
            if (currentPlotData) {
                linePlotProps.data = currentPlotData.values;
                alert(currentPlotData.values);

                // set line color
                linePlotProps.lineColor = getColorForTheme(this.widgetStore.primaryLineColor);

                // Determine scale in X and Y directions. If auto-scaling, use the bounds of the current data
                if (this.widgetStore.isAutoScaledX) {
                    linePlotProps.xMin = currentPlotData.xMin;
                    linePlotProps.xMax = currentPlotData.xMax;
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
            }
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
