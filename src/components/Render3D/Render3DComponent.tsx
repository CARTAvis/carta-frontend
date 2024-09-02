import * as React from "react";
// import ReactResizeDetector from "react-resize-detector";
// import {Colors, FormGroup, HTMLSelect, NonIdealState} from "@blueprintjs/core";
// import * as AST from "ast_wrapper";
// import {CARTA} from "carta-protobuf";
// import {Tick} from "chart.js";
// import * as _ from "lodash";
// action, autorun, , makeObservable, observable
import {computed} from "mobx";
import {observer} from "mobx-react";

// import {LinePlotComponent, LinePlotComponentProps, PlotType, ProfilerInfoComponent, RegionSelectorComponent, SmoothingType, VERTICAL_RANGE_PADDING} from "components/Shared";
// import {Point2D, POLARIZATIONS} from "models";
//AppStore, ASTSettingsString, OverlayStore, SpatialProfileStore, 
import {DefaultWidgetConfig, HelpType, WidgetProps, WidgetsStore} from "stores";
// import {FrameStore} from "stores/Frame";
// RegionId, 
import {Render3DWidgetStore} from "stores/Widgets";

// import {binarySearchByX, clamp, formattedExponential, getColorForTheme, toFixed, transformPoint} from "utilities";
// import {MultiPlotProps, TickType} from "../Shared/LinePlot/PlotContainer/PlotContainerComponent";
import "./Render3DComponent.scss";

// The fixed size of the settings panel popover (excluding the show/hide button)
// const AUTOSCALE_THROTTLE_TIME = 100;

@observer
export class Render3DComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "render-3d",
            type: "render-3d",
            minWidth: 250,
            minHeight: 250,
            defaultWidth: 650,
            defaultHeight: 650,
            title: "3D Rendering",
            isCloseable: true,
            helpType: HelpType.RENDER_3D
        };
    }

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

}
