import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, Switch} from "@blueprintjs/core";
import {AppStore, FrameStore} from "stores";
import {StokesAnalysisWidgetStore} from "stores/widgets";
import {RegionSelectorComponent} from "components";
import "./StokesAnalysisToolbarComponent.css";

@observer
export class StokesAnalysisToolbarComponent extends React.Component<{widgetStore: StokesAnalysisWidgetStore, appStore: AppStore}> {

    private handleFractionalPolChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setFractionalPolVisible(changeEvent.target.checked);
    };

    private handleFrameChanged = (newFrame: FrameStore) => {
        if (newFrame && newFrame.regionSet && !(newFrame.frameInfo.fileInfoExtended.stokes > 1)) {
            this.props.widgetStore.setFractionalPolVisible(false);
        }
    }

    public render() {
        const widgetStore = this.props.widgetStore;

        let enableFractionalPol = false;
        if (widgetStore.effectiveFrame && widgetStore.effectiveFrame.regionSet) {
            enableFractionalPol = widgetStore.effectiveFrame.frameInfo.fileInfoExtended.stokes > 1;
        }

        return (
            <div className="stokes-analysis-toolbar">
                <RegionSelectorComponent widgetStore={this.props.widgetStore} appStore={this.props.appStore} onFrameChanged={this.handleFrameChanged}/>
                <FormGroup label={"Frac. Pol."} inline={true} disabled={!enableFractionalPol}>
                    <Switch checked={widgetStore.fractionalPolVisible} onChange={this.handleFractionalPolChanged} disabled={!enableFractionalPol}/>
                </FormGroup>
            </div>
        );
    }
}