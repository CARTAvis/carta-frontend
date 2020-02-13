import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, HTMLSelect, IOptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore, RegionStore} from "stores";
import {RegionWidgetStore} from "stores/widgets";
import "./RegionSelectorComponent.css";

export enum RegionSelectorType {
    CLOSED_REGIONS = "closed",
    CLOSED_AND_POINT_REGIONS = "closed-and-point"
}

@observer
export class RegionSelectorComponent extends React.Component<{ widgetStore: RegionWidgetStore, appStore: AppStore, type: RegionSelectorType }> {

    private readonly ACTIVE_REGION_VALUE = "active-region";

    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame) {
            let regionId = changeEvent.target.value === this.ACTIVE_REGION_VALUE ? appStore.selectedRegion.regionId : parseInt(changeEvent.target.value);
            this.props.widgetStore.setRegionId(appStore.activeFrame.frameInfo.fileId, regionId);
        }
    };

    public render() {
        const appStore = this.props.appStore;
        const widgetStore = this.props.widgetStore;
        const type = this.props.type;

        let enableRegionSelect = false;
        let regionId = (type === RegionSelectorType.CLOSED_REGIONS) ? -1 : 0;
        let regionOptions: IOptionProps[] = (type === RegionSelectorType.CLOSED_REGIONS) ? [{value: -1, label: "Image"}] : [];

        if (appStore.activeFrame && appStore.activeFrame.regionSet) {
            let fileId = appStore.activeFrame.frameInfo.fileId;
            regionId = widgetStore.regionIdMap.get(fileId) || regionId;
            
            if (appStore.selectedRegion) {
                regionOptions = regionOptions.concat([{
                    value: this.ACTIVE_REGION_VALUE,
                    label: "active region",
                    disabled: appStore.selectedRegion.regionId === regionId
                }]);
            }

            let fiteredRegions: RegionStore[];
            let regions = appStore.activeFrame.regionSet.regions;
            switch (type) {
                case RegionSelectorType.CLOSED_REGIONS:
                    fiteredRegions = regions.filter(r => !r.isTemporary && r.isClosedRegion);
                    break;
                case RegionSelectorType.CLOSED_AND_POINT_REGIONS:
                    fiteredRegions = regions.filter(r => !r.isTemporary && (r.isClosedRegion || r.regionType === CARTA.RegionType.POINT));
                    break;
                default:
                    fiteredRegions = regions;
            }
            regionOptions = regionOptions.concat(fiteredRegions.map(r => {return {value: r.regionId, label: r.nameString}; }));

            enableRegionSelect = regionOptions.length > 1;
        }

        return (
            <FormGroup label={"Region"} inline={true} disabled={!enableRegionSelect}>
                <HTMLSelect value={regionId} options={regionOptions} onChange={this.handleRegionChanged} disabled={!enableRegionSelect}/>
            </FormGroup>
        );
    }
}