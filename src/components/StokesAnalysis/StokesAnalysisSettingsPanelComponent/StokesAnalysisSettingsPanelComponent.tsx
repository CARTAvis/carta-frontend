import * as React from "react";
import {computed} from "mobx";
import {observer} from "mobx-react";
import {ControlGroup, FormGroup, Switch} from "@blueprintjs/core";
import {StokesAnalysisWidgetStore} from "stores/widgets";
import {WidgetProps} from "stores";

@observer
export class StokesAnalysisSettingsPanelComponent extends React.Component<WidgetProps> {

    @computed get widgetStore(): StokesAnalysisWidgetStore {
        if (this.props.appStore && this.props.appStore.widgetsStore.stokesAnalysisWidgets) {
            const widgetStore = this.props.appStore.widgetsStore.stokesAnalysisWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return null;
    }

    handleWcsValuesChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore.setUseWcsValues(changeEvent.target.checked);
    };

    render() {
        const widgetStore = this.widgetStore;
        return (
            <React.Fragment>
                <FormGroup className={"spectral-profile-settings-panel-form"}>
                    <ControlGroup fill={true} vertical={true}>
                        <Switch label={"Use WCS Values"} checked={widgetStore.useWcsValues} onChange={this.handleWcsValuesChanged}/>
                    </ControlGroup>
                </FormGroup>
            </React.Fragment>
        );
    }
}