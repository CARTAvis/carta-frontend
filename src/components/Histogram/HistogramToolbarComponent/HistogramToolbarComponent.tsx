import {observer} from "mobx-react";
import * as React from "react";
import {HistogramWidgetStore} from "stores/widgets";
import {RegionSelectorComponent} from "components/Shared";
import "./HistogramToolbarComponent.scss";

@observer
export class HistogramToolbarComponent extends React.Component<{ widgetStore: HistogramWidgetStore}> {

    public render() {
        return (
            <div className="spectral-profiler-toolbar">
                <RegionSelectorComponent widgetStore={this.props.widgetStore}/>
            </div>
        );
    }
}