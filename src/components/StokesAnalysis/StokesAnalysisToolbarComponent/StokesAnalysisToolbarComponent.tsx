import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, Switch} from "@blueprintjs/core";
import {AppStore} from "stores";
import {StokesAnalysisWidgetStore} from "stores/widgets";
import {RegionSelectorComponent} from "components";
import "./StokesAnalysisToolbarComponent.css";

@observer
export class StokesAnalysisToolbarComponent extends React.Component<{widgetStore: StokesAnalysisWidgetStore}> {

    private handleFractionalPolChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setFractionalPolVisible(changeEvent.target.checked);
    };

    public render() {
        const widgetStore = this.props.widgetStore;
        const frame = AppStore.Instance.activeFrame;

        let enableFractionalPol = false;
        if (frame && frame.regionSet) {
            enableFractionalPol = frame.frameInfo.fileInfoExtended.stokes > 1;
        }

        return (
            <div className="stokes-analysis-toolbar">
                <RegionSelectorComponent widgetStore={this.props.widgetStore}/>
                <FormGroup label={"Frac. Pol."} inline={true} disabled={!enableFractionalPol}>
                    <Switch checked={widgetStore.fractionalPolVisible} onChange={this.handleFractionalPolChanged} disabled={!enableFractionalPol}/>
                </FormGroup>
            </div>
        );
    }
}