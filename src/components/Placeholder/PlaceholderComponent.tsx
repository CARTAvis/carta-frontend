import * as React from "react";
import {H2} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {HelpType} from "enums";
import {type DefaultWidgetConfig} from "stores";

import "./PlaceholderComponent.scss";

class PlaceholderComponentProps {
    id: string;
    label: string;
    isDocked: boolean;
}

@observer
export class PlaceholderComponent extends React.Component<PlaceholderComponentProps> {
    public static get WidgetConfig(): DefaultWidgetConfig {
        return {
            id: "placeholder",
            type: "placeholder",
            minWidth: 225,
            minHeight: 225,
            defaultWidth: 300,
            defaultHeight: 225,
            title: "Placeholder",
            isCloseable: true,
            helpType: HelpType.PLACEHOLDER
        };
    }

    render() {
        return (
            <div className="placeholder-container">
                <H2>{this.props.label}</H2>
            </div>
        );
    }
}
