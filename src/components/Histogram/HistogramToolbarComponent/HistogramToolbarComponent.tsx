import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, HTMLSelect, IOptionProps} from "@blueprintjs/core";
import {AppStore} from "stores";
import {HistogramWidgetStore} from "stores/widgets";
import "./HistogramToolbarComponent.css";

@observer
export class HistogramToolbarComponent extends React.Component<{ widgetStore: HistogramWidgetStore, appStore: AppStore }> {

    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame) {
            let regionId: number;
            if (changeEvent.target.value === "active-region") {
                regionId = appStore.selectedRegion.regionId;
            } else {
                regionId = parseInt(changeEvent.target.value);
            }
            this.props.widgetStore.setRegionId(appStore.activeFrame.frameInfo.fileId, regionId);
        }
    };

    public render() {
        const appStore = this.props.appStore;
        const widgetStore = this.props.widgetStore;

        let regionId = -1;
        let enableRegionSelect = false;
        // Fill region select options with all non-temporary regions that are closed
        let profileRegionOptions: IOptionProps[] = [{value: -1, label: "Image"}];
        if (appStore.activeFrame && appStore.activeFrame.regionSet) {
            let fileId = appStore.activeFrame.frameInfo.fileId;
            regionId = widgetStore.regionIdMap.get(fileId) || -1;
            if (appStore.selectedRegion) {
                profileRegionOptions = profileRegionOptions.concat([{value: "active-region", label: "active region", disabled: appStore.selectedRegion.regionId === regionId }]);
            }
            profileRegionOptions = profileRegionOptions.concat(this.props.appStore.activeFrame.regionSet.regions.filter(r => !r.isTemporary && r.isClosedRegion).map(r => {
                return {
                    value: r.regionId,
                    label: r.nameString
                };
            }));
            enableRegionSelect = profileRegionOptions.length > 1;
        }

        return (
            <div className="spectral-profiler-toolbar">
                <FormGroup label={"Region"} inline={true} disabled={!enableRegionSelect}>
                    <HTMLSelect value={regionId} options={profileRegionOptions} onChange={this.handleRegionChanged} disabled={!enableRegionSelect}/>
                </FormGroup>
            </div>
        );
    }
}