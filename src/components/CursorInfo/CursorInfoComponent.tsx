import * as React from "react";
import {observer} from "mobx-react";
import {HTMLTable} from "@blueprintjs/core";
import {DefaultWidgetConfig, WidgetProps} from "stores";

@observer
export class CursorInfoComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "cursor-info",
            type: "cursor-info",
            minWidth: 350,
            minHeight: 180,
            defaultWidth: 650,
            defaultHeight: 180,
            title: "Cursor Information",
            isCloseable: true,
        };
    }

    render() {
        return (
            <div className="cursor-info-widget">
                <HTMLTable>
                </HTMLTable>
            </div>
        );
    }
}