import * as React from "react";
// import {FormGroup, Tab, Tabs} from "@blueprintjs/core";
// import {CARTA} from "carta-protobuf";
// autorun, 
import {computed} from "mobx";
import {observer} from "mobx-react";

// import {LinePlotSettingsPanelComponent, LinePlotSettingsPanelComponentProps, SafeNumericInput, SmoothingSettingsComponent} from "components/Shared";
// import {LineKey} from "models";
// AppStore, 
import {DefaultWidgetConfig, HelpType, WidgetProps, WidgetsStore} from "stores";
// RegionId, 
import {Render3DWidgetStore} from "stores/Widgets";

// import {parseNumber} from "utilities";
import "./Render3DSettingsPanelComponent.scss";

// const KEYCODE_ENTER = 13;

export enum Render3DSettingsTabs {
    STYLING,
    SMOOTHING,
    COMPUTATION
}

@observer
export class Render3DSettingsPanelComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "render-3d-floating-settings",
            type: "floating-settings",
            minWidth: 280,
            minHeight: 225,
            defaultWidth: 400,
            defaultHeight: 450,
            title: "render-3d-settings",
            isCloseable: true,
            parentId: "render-3d",
            parentType: "render-3d",
            helpType: [HelpType.SPATIAL_PROFILER_SETTINGS_STYLING, HelpType.SPATIAL_PROFILER_SETTINGS_SMOOTHING, HelpType.SPATIAL_PROFILER_SETTINGS_COMPUTATION]
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
        return null;
    }


 
}
