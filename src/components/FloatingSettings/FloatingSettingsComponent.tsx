import * as React from "react";
import {observer} from "mobx-react";
import {WidgetConfig} from "stores";

export interface FloatingSettingsComponentProps {
    children?: any;
}

@observer
export class FloatingSettingsComponent extends React.Component<FloatingSettingsComponentProps> {

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "floating-settings",
            type: "floating-settings",
            minWidth: 200,
            minHeight: 300,
            defaultWidth: 350,
            defaultHeight: 400,
            title: "floating-settings",
            isCloseable: true,
            parentId: "floating-settings",
            parentType: "floating-settings"
        };
    }

    public render() {
        return (
            <div className={"floating-settings-container"}>
                {this.props.children}
            </div>
        );
    }
}