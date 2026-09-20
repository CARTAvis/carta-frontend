import * as React from "react";
import {Button, ButtonGroup, FormGroup, HTMLSelect, InputGroup, Tab, Tabs} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {RegionGroupType} from "enums";
import {AppStore, type RegionGroupStore} from "stores";

@observer
export class RegionGroupManagerComponent extends React.Component {
    @observable private selectedRegionGroupId: string | undefined;

    constructor(props: {}) {
        super(props);
        makeObservable(this);
    }

    @action private selectRegionGroup = (regionGroupId: string) => {
        this.selectedRegionGroupId = regionGroupId;
    };

    @action private createRegionGroup = () => {
        this.selectedRegionGroupId = AppStore.Instance.createRegionGroup().regionGroupId;
    };

    private copyRegionGroup = (regionGroup: RegionGroupStore) => {
        this.selectedRegionGroupId = AppStore.Instance.copyRegionGroup(regionGroup.regionGroupId).regionGroupId;
    };

    @action private deleteRegionGroup = (regionGroup: RegionGroupStore) => {
        const appStore = AppStore.Instance;
        const groups = appStore.regionGroupStores;
        const deletedIndex = groups.findIndex(group => group.regionGroupId === regionGroup.regionGroupId);
        appStore.deleteRegionGroup(regionGroup.regionGroupId);
        this.selectedRegionGroupId = groups[deletedIndex + 1]?.regionGroupId ?? groups[deletedIndex - 1]?.regionGroupId;
    };

    private updateRegion = (regionGroup: RegionGroupStore, frameId: number, value: string) => {
        if (!value) {
            regionGroup.removeRegion(frameId);
            return;
        }

        const regionId = Number(value);
        const regionStatsMap = AppStore.Instance.regionStats.get(frameId)?.get(regionId);
        const regionStats = regionStatsMap ? Array.from(regionStatsMap.values())[0] : undefined;
        regionGroup.setRegion(frameId, regionId, {
            regionSum: regionStats?.statistics?.find(stat => stat.statsType === CARTA.StatsType.Sum)?.value,
            regionMean: regionStats?.statistics?.find(stat => stat.statsType === CARTA.StatsType.Mean)?.value
        });
    };

    private renderFrame = (regionGroup: RegionGroupStore, frame: AppStore["frames"][number]) => {
        const region = regionGroup.regionGroup.get(frame.id);
        const options = [{value: "", label: "No region"}, ...frame.regionSet.regions.filter(candidate => !candidate.isTemporary && candidate.regionId !== 0).map(candidate => ({value: candidate.regionId, label: candidate.nameString}))];

        return (
            <FormGroup key={frame.id} label={frame.filename} inline={true}>
                <HTMLSelect value={region?.regionId ?? ""} options={options} onChange={event => this.updateRegion(regionGroup, frame.id, event.currentTarget.value)} />
            </FormGroup>
        );
    };

    private renderGroup = (regionGroup: RegionGroupStore) => {
        const appStore = AppStore.Instance;
        return (
            <div className="region-group-panel">
                <FormGroup label="Name">
                    <InputGroup value={regionGroup.regionGroupName} onChange={event => regionGroup.setName(event.currentTarget.value)} />
                </FormGroup>
                <FormGroup label="Type" inline={true}>
                    <HTMLSelect value={regionGroup.regionGroupType} options={Object.values(RegionGroupType)} onChange={event => regionGroup.setType(event.currentTarget.value as RegionGroupType)} />
                </FormGroup>
                {appStore.frames.map(frame => this.renderFrame(regionGroup, frame))}
                <ButtonGroup>
                    <Button icon="duplicate" text="Copy" onClick={() => this.copyRegionGroup(regionGroup)} />
                    <Button icon="trash" text="Delete" onClick={() => this.deleteRegionGroup(regionGroup)} />
                </ButtonGroup>
            </div>
        );
    };

    render() {
        const appStore = AppStore.Instance;
        const groups = appStore.regionGroupStores;
        const selectedRegionGroupId = groups.some(group => group.regionGroupId === this.selectedRegionGroupId) ? this.selectedRegionGroupId : groups[0]?.regionGroupId;

        return (
            <div className="region-group-manager">
                <Button icon="add" text="New region group" onClick={this.createRegionGroup} />
                {groups.length > 0 && (
                    <Tabs selectedTabId={selectedRegionGroupId} onChange={tabId => this.selectRegionGroup(String(tabId))}>
                        {groups.map(group => (
                            <Tab key={group.regionGroupId} id={group.regionGroupId} title={group.regionGroupName} panel={this.renderGroup(group)} />
                        ))}
                    </Tabs>
                )}
            </div>
        );
    }
}
