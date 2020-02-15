import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, HTMLSelect, IOptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore, RegionStore} from "stores";
import {RegionWidgetStore, RegionsType, RegionId} from "stores/widgets";
import "./RegionSelectorComponent.css";

@observer
export class RegionSelectorComponent extends React.Component<{ widgetStore: RegionWidgetStore, appStore: AppStore }> {

    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame) {
            this.props.widgetStore.setRegionId(appStore.activeFrame.frameInfo.fileId, parseInt(changeEvent.target.value));
        }
    };

    public render() {
        const appStore = this.props.appStore;
        const widgetStore = this.props.widgetStore;

        let enableRegionSelect = false;
        let selectedValue: number = RegionId.ACTIVE;
        let regionOptions: IOptionProps[] = [{value: RegionId.ACTIVE, label: "Active"}];
        if (widgetStore.type === RegionsType.CLOSED) {
            regionOptions = regionOptions.concat([{value: RegionId.IMAGE, label: "Image"}]);
        }

        if (appStore.activeFrame && appStore.activeFrame.regionSet) {
            selectedValue = widgetStore.regionIdMap.get(appStore.activeFrame.frameInfo.fileId);

            let fiteredRegions: RegionStore[];
            let regions = appStore.activeFrame.regionSet.regions;
            switch (widgetStore.type) {
                case RegionsType.CLOSED:
                    fiteredRegions = regions.filter(r => !r.isTemporary && r.isClosedRegion);
                    break;
                case RegionsType.CLOSED_AND_POINT:
                    fiteredRegions = regions.filter(r => !r.isTemporary && (r.isClosedRegion || r.regionType === CARTA.RegionType.POINT));
                    break;
                default:
                    fiteredRegions = regions;
            }
            regionOptions = regionOptions.concat(fiteredRegions.map(r => {return {value: r.regionId, label: r.nameString}; }));

            enableRegionSelect = regionOptions.length > 2;
        }

        return (
            <FormGroup label={"Region"} inline={true} disabled={!enableRegionSelect}>
                <HTMLSelect value={selectedValue} options={regionOptions} onChange={this.handleRegionChanged} disabled={!enableRegionSelect}/>
            </FormGroup>
        );
    }
}