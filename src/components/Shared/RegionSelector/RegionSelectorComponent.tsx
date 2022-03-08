import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, HTMLSelect, IOptionProps} from "@blueprintjs/core";
import {AppStore, RegionStore, FrameStore} from "stores";
import {RegionWidgetStore, RegionsType, RegionId, ACTIVE_FILE_ID} from "stores/widgets";
import "./RegionSelectorComponent.scss";

@observer
export class RegionSelectorComponent extends React.Component<{widgetStore: RegionWidgetStore; disableClosedRegion?: boolean; onFrameChanged?: (newFrame: FrameStore) => void}> {
    private handleFrameChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        const appStore = AppStore.Instance;
        const widgetStore = this.props.widgetStore;
        if (appStore.activeFrame) {
            const selectedFileId = parseInt(changeEvent.target.value);
            widgetStore.setFileId(selectedFileId);
            widgetStore.setRegionId(widgetStore.effectiveFrame.frameInfo.fileId, RegionId.ACTIVE);
            if (this.props.onFrameChanged) {
                this.props.onFrameChanged(widgetStore.effectiveFrame);
            }
        }
    };

    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        const appStore = AppStore.Instance;
        const widgetStore = this.props.widgetStore;
        if (appStore.activeFrame) {
            const fileId = widgetStore.effectiveFrame.frameInfo.fileId;
            widgetStore.setFileId(fileId);
            widgetStore.setRegionId(fileId, parseInt(changeEvent.target.value));
        }
    };

    public render() {
        const appStore = AppStore.Instance;
        const widgetStore = this.props.widgetStore;

        let enableFrameselect = false;
        let selectedFrameValue: number = ACTIVE_FILE_ID;
        if (appStore.activeFrame) {
            selectedFrameValue = widgetStore.fileId;
            enableFrameselect = true;
        }

        let enableRegionSelect = false;
        let selectedValue: number = RegionId.ACTIVE;
        let regionOptions: IOptionProps[] = [{value: RegionId.ACTIVE, label: "Active"}];

        if (widgetStore.effectiveFrame && widgetStore.effectiveFrame.regionSet) {
            if (widgetStore.type === RegionsType.CLOSED) {
                regionOptions = regionOptions.concat([{value: RegionId.IMAGE, label: "Image"}]);
            }

            let fiteredRegions: RegionStore[];
            let regions = widgetStore.effectiveFrame.regionSet.regions;
            
            switch (widgetStore.type) {
                default:
                    fiteredRegions = regions;
            }

            regionOptions = regionOptions.concat(
                fiteredRegions.map(r => {
                    return {value: r.regionId, label: r.nameString, disabled: this.props.disableClosedRegion ? r.isClosedRegion : false};
                })
            );

            if (widgetStore.type === RegionsType.CLOSED_AND_POINT && regionOptions.length === 1) {
                regionOptions = regionOptions.concat([{value: RegionId.CURSOR, label: "Cursor"}]);
            }

            selectedValue = widgetStore.regionIdMap.get(widgetStore.effectiveFrame.frameInfo.fileId);
            enableRegionSelect = true;
        }

        let frameClassName = "unlinked-to-selected";
        let regionClassName = "unlinked-to-selected";
        const linkedClass = "linked-to-selected";

        if (widgetStore.isEffectiveFrameEqualToActiveFrame && widgetStore.fileId !== ACTIVE_FILE_ID) {
            frameClassName = AppStore.Instance.darkTheme ? `${linkedClass} dark-theme` : linkedClass;
        }

        if (widgetStore.matchesSelectedRegion && selectedValue !== undefined && selectedValue !== RegionId.ACTIVE) {
            regionClassName = AppStore.Instance.darkTheme ? `${linkedClass} dark-theme` : linkedClass;
        }

        return (
            <React.Fragment>
                <FormGroup label={"Image"} inline={true} disabled={!enableFrameselect}>
                    <HTMLSelect className={frameClassName} value={selectedFrameValue} options={widgetStore.frameOptions} onChange={this.handleFrameChanged} disabled={!enableFrameselect} style={{width: "100px"}} />
                </FormGroup>
                <FormGroup label={"Region"} inline={true} disabled={!enableRegionSelect}>
                    <HTMLSelect className={regionClassName} value={selectedValue} options={regionOptions} onChange={this.handleRegionChanged} disabled={!enableRegionSelect} />
                </FormGroup>
            </React.Fragment>
        );
    }
}
