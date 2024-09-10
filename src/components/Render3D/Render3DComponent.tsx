import * as React from "react";
// import ReactResizeDetector from "react-resize-detector";
import {Divider, Tab, Tabs} from "@blueprintjs/core";
// import {CARTA} from "carta-protobuf";
import {computed, makeObservable} from "mobx";
import {observer} from "mobx-react"; 

// import {TaskProgressDialogComponent} from "components/Dialogs";
import {RegionSelectorComponent} from "components/Shared";
// import {Point2D} from "models";
import {AppStore, DefaultWidgetConfig, HelpType, WidgetProps, WidgetsStore} from "stores";
// import {FrameStore} from "stores/Frame";
import {Render3DWidgetStore} from "stores/Widgets";

import {IsoSurfaceComponent} from "./IsoSurfaceComponent/IsoSurfaceComponent";

// import {clamp, getColorForTheme} from "utilities";
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

    render() {
        const widgetStore = this.widgetStore;
        
        // const isoSurfacesLevelsPanel = (
        //     <div>
        //         Levels
        //     </div>
        // );

        const isoSurfacesConfigurationPanel = (
            <div>configuration</div>
        );

        const isoSurfacesStylingPanel = (
            <div>styling</div>
        );

        const isoSurfacesPanel = (
            <div>
                <Tabs defaultSelectedTabId={IsoSurfaceTabs.Levels} renderActiveTabPanelOnly={false}>
                    <Tab id={IsoSurfaceTabs.Levels} title="Levels" panel={<IsoSurfaceComponent widgetStore={this.widgetStore}/>} panelClassName="render-3d-isosurfaces-levels-panel" data-testid="render-3d-isosurfaces-levels-tab-title" />
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
                <div className="spectral-profiler-toolbar">
                    <RegionSelectorComponent widgetStore={widgetStore} />
                </div>
                <div className="render-3d-panel">
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
