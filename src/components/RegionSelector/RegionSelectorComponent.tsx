import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, HTMLSelect, IOptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore, RegionStore} from "stores";
import {RegionWidgetStore, RegionsType, RegionId, CURRENT_FILE_ID} from "stores/widgets";

import "./RegionSelectorComponent.css";

@observer
export class RegionSelectorComponent extends React.Component<{ widgetStore: RegionWidgetStore, appStore: AppStore }> {

    private handleFrameChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        const appStore = this.props.appStore;
        const widgetStore = this.props.widgetStore;
        if (appStore.activeFrame) {
            const selectedFileId = parseInt(changeEvent.target.value);
            widgetStore.setFileId(selectedFileId);
            widgetStore.setRegionId(widgetStore.effectiveFrame.frameInfo.fileId, RegionId.ACTIVE);
        }
    };

    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        const appStore = this.props.appStore;
        const widgetStore = this.props.widgetStore;
        if (appStore.activeFrame) {
            const fileId = widgetStore.effectiveFrame.frameInfo.fileId;
            widgetStore.setFileId(fileId);
            widgetStore.setRegionId(fileId, parseInt(changeEvent.target.value));
        }
    };

    public render() {
        const appStore = this.props.appStore;
        const widgetStore = this.props.widgetStore;

        let enableFrameselect = false;
        let selectedFrameValue: number = CURRENT_FILE_ID;
        let frameOptions: IOptionProps[] = [{value: CURRENT_FILE_ID, label: "Current"}];

        if (appStore.activeFrame) {
            frameOptions = frameOptions.concat(appStore.frameNames);
            selectedFrameValue = widgetStore.fileId;
            enableFrameselect = true;
        }

        let enableRegionSelect = false;
        let selectedValue: number = RegionId.ACTIVE;
        let regionOptions: IOptionProps[] = [{value: RegionId.ACTIVE, label: "Active"}];

        if (appStore.activeFrame && widgetStore.effectiveFrame && widgetStore.effectiveFrame.regionSet) {
            if (widgetStore.type === RegionsType.CLOSED) {
                regionOptions = regionOptions.concat([{value: RegionId.IMAGE, label: "Image"}]);
            }

            let fiteredRegions: RegionStore[];
            let regions = widgetStore.effectiveFrame.regionSet.regions;

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

            if (widgetStore.type === RegionsType.CLOSED_AND_POINT && regionOptions.length === 1) {
                regionOptions = regionOptions.concat([{value: RegionId.CURSOR, label: "Cursor"}]);
            }

            selectedValue = widgetStore.regionIdMap.get(widgetStore.effectiveFrame.frameInfo.fileId);
            enableRegionSelect = true;
        }

        return (
            <React.Fragment>
                <FormGroup label={"Frame"} inline={true} disabled={!enableFrameselect}>
                    <HTMLSelect value={selectedFrameValue} options={frameOptions} onChange={this.handleFrameChanged} disabled={!enableFrameselect} style={{width: "100px"}}/>
                </FormGroup>
                <FormGroup label={"Region"} inline={true} disabled={!enableRegionSelect}>
                    <HTMLSelect value={selectedValue} options={regionOptions} onChange={this.handleRegionChanged} disabled={!enableRegionSelect}/>
                </FormGroup>
            </React.Fragment>
        );
    }
}