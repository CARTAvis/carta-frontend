import * as React from "react";
// import ReactResizeDetector from "react-resize-detector";
// Colors,  , NonIdealState
import {Divider, FormGroup, HTMLSelect, Tab, Tabs} from "@blueprintjs/core";
// import {Select} from "@blueprintjs/select";
// import * as AST from "ast_wrapper";
// import {CARTA} from "carta-protobuf";
// import {Tick} from "chart.js";
// import * as _ from "lodash";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react"; 

// import {TaskProgressDialogComponent} from "components/Dialogs";
// import {LinePlotComponent, LinePlotComponentProps, PlotType, ProfilerInfoComponent, RegionSelectorComponent, SmoothingType, VERTICAL_RANGE_PADDING} from "components/Shared";
// import {Point2D, POLARIZATIONS} from "models";
//ASTSettingsString, OverlayStore,  PreferenceStore,
import {AppStore, DefaultWidgetConfig, HelpType, WidgetProps, WidgetsStore} from "stores";
// import {FrameStore} from "stores/Frame";
//    , RenderConfigWidgetStore
import {RegionId, Render3DWidgetStore} from "stores/Widgets";

// import {binarySearchByX, clamp, formattedExponential, getColorForTheme, toFixed, transformPoint} from "utilities";
// import {MultiPlotProps, TickType} from "../Shared/LinePlot/PlotContainer/PlotContainerComponent";
import "./Render3DComponent.scss";

// The fixed size of the settings panel popover (excluding the show/hide button)
// const AUTOSCALE_THROTTLE_TIME = 100;

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

    // return header with region properties
    @computed get exportHeader(): string[] {
        const headerString: string[] = [];
        if (this.widgetStore.effectiveRegion) {
            headerString.push(...this.widgetStore.effectiveFrame.getRegionProperties(this.widgetStore.effectiveRegionId));
        }
        return headerString;
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

    @action private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    // handle changing the data source
    private handleFrameChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        if (this.widgetStore.effectiveFrame) {
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

    render() {
        const appStore = AppStore.Instance;
        const frame = this.widgetStore.effectiveFrame;
        const fileInfo = frame ? `${appStore.getFrameIndex(frame.frameInfo.fileId)}: ${frame.filename}` : undefined;
        const regionInfo = this.widgetStore.effectiveRegionInfo;

        let selectedValue = RegionId.NONE;
        if (this.widgetStore.effectiveFrame?.regionSet) {
            selectedValue = this.widgetStore.regionIdMap.get(this.widgetStore.effectiveFrame.frameInfo.fileId);
        }

        const isoSurfacesLevelsPanel = (
            <div>levels</div>
        );

        const isoSurfacesConfigurationPanel = (
            <div>configuration</div>
        );

        const isoSurfacesStylingPanel = (
            <div>styling</div>
        );

        const isoSurfacesPanel = (
            <div>
                <Divider />
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
