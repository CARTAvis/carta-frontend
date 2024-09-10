import * as React from "react";
import {observer} from "mobx-react";

import {Render3DWidgetStore} from "stores/Widgets";

import "./VolumeComponent.css";

@observer
export class VolumeComponent extends React.Component<{widgetStore: Render3DWidgetStore}> {
    public render() {
        return (
            <div className="volume-comp">
                VOLUME
            </div>
        );
    }
}