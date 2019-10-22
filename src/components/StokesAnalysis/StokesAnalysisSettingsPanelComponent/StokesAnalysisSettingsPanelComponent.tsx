import * as React from "react";
import {computed, autorun} from "mobx";
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

    @computed get matchesSelectedRegion() {
        const appStore = this.props.appStore;
        const frame = appStore.activeFrame;
        if (frame) {
            const widgetRegion = this.widgetStore.regionIdMap.get(frame.frameInfo.fileId);
            if (frame.regionSet.selectedRegion && frame.regionSet.selectedRegion.regionId !== 0) {
                return widgetRegion === frame.regionSet.selectedRegion.regionId;
            }
        }
        return false;
    }

    constructor(props: WidgetProps) {
        super(props);

        autorun(() => {
            if (this.widgetStore) {
                const appStore = this.props.appStore;
                const frame = appStore.activeFrame;
                if (frame) {
                    const regionId = this.widgetStore.regionIdMap.get(frame.frameInfo.fileId) || 0;
                    const regionString = regionId === 0 ? "Cursor" : `Region #${regionId}`;
                    const selectedString = this.matchesSelectedRegion ? "(Selected)" : "";
                    this.props.appStore.widgetsStore.setWidgetTitle(this.props.floatingSettingsId, `Stokes Analysis Settings: ${regionString} ${selectedString}`);
                }
            }
        });
    }

    handleWcsValuesChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore.setUseWcsValues(changeEvent.target.checked);
    };

    render() {
        const widgetStore = this.widgetStore;
        return (
            <React.Fragment>
                {widgetStore &&
                <FormGroup className={"spectral-profile-settings-panel-form"}>
                    <ControlGroup fill={true} vertical={true}>
                        <Switch label={"Use WCS Values"} checked={widgetStore.useWcsValues} onChange={this.handleWcsValuesChanged}/>
                    </ControlGroup>
                </FormGroup>
                }
            </React.Fragment>
        );
    }
}