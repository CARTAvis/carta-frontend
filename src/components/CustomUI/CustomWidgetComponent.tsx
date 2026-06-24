import * as React from "react";
import {observer} from "mobx-react";

import {HelpType} from "enums";
import {type DefaultWidgetConfig, type WidgetProps} from "stores";

import {CustomUIContent} from "./CustomUIContent";

@observer
export class CustomWidgetComponent extends React.Component<WidgetProps> {
    public static get WidgetConfig(): DefaultWidgetConfig {
        return {
            id: "custom",
            type: "custom",
            minWidth: 200,
            minHeight: 150,
            defaultWidth: 400,
            defaultHeight: 300,
            title: "Custom",
            isCloseable: true,
            helpType: HelpType.PLACEHOLDER
        };
    }

    render() {
        return (
            <div className="custom-widget" style={{width: "100%", height: "100%", overflow: "auto"}}>
                <CustomUIContent id={this.props.id} />
            </div>
        );
    }
}
