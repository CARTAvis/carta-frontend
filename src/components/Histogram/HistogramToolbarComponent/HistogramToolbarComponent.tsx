import {observer} from "mobx-react";
import * as React from "react";
import {AppStore} from "stores";
import {HistogramWidgetStore} from "stores/widgets";
import {RegionSelectorComponent} from "components";
import "./HistogramToolbarComponent.css";

@observer
export class HistogramToolbarComponent extends React.Component<{ widgetStore: HistogramWidgetStore, appStore: AppStore }> {

    public render() {
        return (
            <div className="spectral-profiler-toolbar">
                <RegionSelectorComponent widgetStore={this.props.widgetStore} appStore={this.props.appStore}/>
            </div>
        );
    }
}