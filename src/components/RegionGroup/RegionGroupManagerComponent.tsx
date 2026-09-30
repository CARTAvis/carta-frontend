import * as React from "react";
import {Button, ButtonGroup, FormGroup, HTMLSelect, Icon, InputGroup, Position, Tab, Tabs, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {observer} from "mobx-react";

import {RegionGroupType} from "enums";
import {AppStore, type RegionGroupStore, type WidgetProps} from "stores";
import {type FrameStore, type RegionStore} from "stores/Frame";

import "./RegionGroupManagerComponent.scss";

@observer
export class RegionGroupManagerComponent extends React.Component<WidgetProps, {selectedRegionGroupId?: string}> {
    constructor(props: WidgetProps) {
        super(props);
        this.state = {};
    }

    private selectRegionGroup = (regionGroupId?: string) => {
        this.setState({selectedRegionGroupId: regionGroupId});
        AppStore.Instance.setRegionGroupManagerSelectedId(regionGroupId);
    };

    private createRegionGroup = (type: RegionGroupType = RegionGroupType.TIME_SERIES) => {
        const appStore = AppStore.Instance;
        const regionGroup = appStore.createRegionGroup(type);
        if (!regionGroup) {
            return;
        }
        if (type === RegionGroupType.REGION_SERIES) {
            this.selectRegionSeriesFrame(regionGroup, (appStore.activeFrame ?? appStore.frames[0])?.id);
        }
        this.selectRegionGroup(regionGroup.regionGroupId);
    };

    private deleteRegionGroup = (regionGroup: RegionGroupStore) => {
        const appStore = AppStore.Instance;
        const groups = appStore.regionGroupStores;
        const deletedIndex = groups.findIndex(group => group.regionGroupId === regionGroup.regionGroupId);
        appStore.deleteRegionGroup(regionGroup.regionGroupId);
        this.selectRegionGroup(groups[deletedIndex + 1]?.regionGroupId ?? groups[deletedIndex - 1]?.regionGroupId);
    };

    private updateRegion = (regionGroup: RegionGroupStore, frameId: number, value: string) => {
        if (!value) {
            regionGroup.removeRegion(frameId);
            return;
        }

        const regionId = Number(value);
        const current = regionGroup.regionGroup.get(frameId);
        const regionStats = current?.stokes === undefined ? undefined : AppStore.Instance.regionStats.get(frameId)?.get(regionId)?.get(current.stokes);
        regionGroup.setRegion(frameId, regionId, {
            regionSum: regionStats?.statistics?.find(stat => stat.statsType === CARTA.StatsType.Sum)?.value ?? undefined,
            regionFluxDensity: regionStats?.statistics?.find(stat => stat.statsType === CARTA.StatsType.FluxDensity)?.value ?? undefined,
            regionMean: regionStats?.statistics?.find(stat => stat.statsType === CARTA.StatsType.Mean)?.value ?? undefined,
            regionMax: regionStats?.statistics?.find(stat => stat.statsType === CARTA.StatsType.Max)?.value ?? undefined
        });
    };

    private updateType = (regionGroup: RegionGroupStore, type: RegionGroupType) => {
        const appStore = AppStore.Instance;
        if ((type === RegionGroupType.TIME_SERIES || type === RegionGroupType.REGION_SERIES) && regionGroup.regionGroupType === RegionGroupType.FREQUENCY_SERIES && appStore.isCurveLimitReached) {
            return;
        }
        regionGroup.setType(type);
        if (type === RegionGroupType.REGION_SERIES) {
            this.selectRegionSeriesFrame(regionGroup, (appStore.activeFrame ?? appStore.frames[0])?.id);
        }
    };

    private selectRegionSeriesFrame = (regionGroup: RegionGroupStore, frameId?: number) => {
        regionGroup.setRegionSeriesFrame(frameId);
        AppStore.Instance.syncRegionSeriesGroup(regionGroup);
    };

    private renderFrame = (regionGroup: RegionGroupStore, frame: FrameStore) => {
        const region = regionGroup.regionGroup.get(frame.id);
        const options = frame.regionSet.editableRegionsList.filter(candidate => candidate.isClosedRegion).map(candidate => ({value: candidate.regionId, label: candidate.nameString}));
        const isDisplayed = region?.isDisplayed !== false;
        const displayIcon = isDisplayed ? "eye-open" : "eye-off";

        return (
            <FormGroup
                key={frame.id}
                className="region-entry"
                label={
                    <span className="region-group-frame-label">
                        <Tooltip content={isDisplayed ? "Hide frame" : "Show frame"} position={Position.BOTTOM}>
                            <Icon
                                icon={displayIcon}
                                aria-label={isDisplayed ? "Hide frame" : "Show frame"}
                                onClick={region ? () => regionGroup.setDisplayed(frame.id, !isDisplayed) : undefined}
                                style={{cursor: region ? "pointer" : "default", opacity: region ? 1 : 0.3}}
                            />
                        </Tooltip>
                        {frame.filename}
                    </span>
                }
                inline={true}
            >
                <HTMLSelect
                    value={region?.regionId ?? ""}
                    options={options.length ? options : [{value: "", label: "No region"}]}
                    disabled={options.length <= 1}
                    onChange={event => this.updateRegion(regionGroup, frame.id, event.currentTarget.value)}
                />
            </FormGroup>
        );
    };

    private renderRegion = (regionGroup: RegionGroupStore, region: RegionStore) => {
        const entry = regionGroup.regionGroup.get(region.regionId);
        const isDisplayed = entry?.isDisplayed !== false;
        return (
            <div key={region.regionId} className="region-entry">
                <span className="region-group-frame-label">
                    <Tooltip content={isDisplayed ? "Hide region" : "Show region"} position={Position.BOTTOM}>
                        <Icon
                            icon={isDisplayed ? "eye-open" : "eye-off"}
                            aria-label={isDisplayed ? "Hide region" : "Show region"}
                            onClick={entry ? () => regionGroup.setDisplayed(region.regionId, !isDisplayed) : undefined}
                            style={{cursor: entry ? "pointer" : "default", opacity: entry ? 1 : 0.3}}
                        />
                    </Tooltip>
                    {region.nameString}
                </span>
            </div>
        );
    };

    private renderGroup = (regionGroup: RegionGroupStore) => {
        const appStore = AppStore.Instance;
        const groupName = this.getRegionGroupLabel(regionGroup);
        const typeOptions = Object.values(RegionGroupType).map(type => ({
            value: type,
            label: type,
            disabled: (type === RegionGroupType.TIME_SERIES || type === RegionGroupType.REGION_SERIES) && regionGroup.regionGroupType === RegionGroupType.FREQUENCY_SERIES && appStore.isCurveLimitReached
        }));
        return (
            <div className="region-group-panel">
                <FormGroup label="Name">
                    <InputGroup value={groupName} onChange={event => regionGroup.setName(event.currentTarget.value)} />
                </FormGroup>
                <FormGroup label="Type" inline={true}>
                    <HTMLSelect value={regionGroup.regionGroupType} options={typeOptions} onChange={event => this.updateType(regionGroup, event.currentTarget.value as RegionGroupType)} />
                </FormGroup>
                {regionGroup.regionGroupType === RegionGroupType.TIME_SERIES && appStore.timeSeriesStore.elements.map(({frame}) => this.renderFrame(regionGroup, frame))}
                {regionGroup.regionGroupType === RegionGroupType.REGION_SERIES && (
                    <>
                        <FormGroup label="Frame" inline={true}>
                            <HTMLSelect
                                value={regionGroup.regionSeriesFrameId ?? ""}
                                options={appStore.frameNames.length ? appStore.frameNames : [{value: "", label: "No frame"}]}
                                disabled={!appStore.frames.length}
                                onChange={event => this.selectRegionSeriesFrame(regionGroup, event.currentTarget.value ? Number(event.currentTarget.value) : undefined)}
                            />
                        </FormGroup>
                        {appStore
                            .getFrame(regionGroup.regionSeriesFrameId ?? NaN)
                            ?.regionSet.editableRegionsList.filter(region => region.isClosedRegion)
                            .map(region => this.renderRegion(regionGroup, region))}
                    </>
                )}
                <ButtonGroup>
                    <Button icon="add" text="New light curve" onClick={() => this.createRegionGroup()} disabled={!appStore.timeSeriesStore.elements.length || appStore.isCurveLimitReached} />
                    <Button icon="add" text="New region series" onClick={() => this.createRegionGroup(RegionGroupType.REGION_SERIES)} disabled={!appStore.frames.length || appStore.isCurveLimitReached} />
                    <Button icon="trash" text="Delete" onClick={() => this.deleteRegionGroup(regionGroup)} />
                </ButtonGroup>
            </div>
        );
    };

    private getRegionGroupLabel = (group: RegionGroupStore) => {
        if (group.regionGroupType === RegionGroupType.TIME_SERIES) {
            return group.regionGroupName.replace(/^Region Group/, "Light curve");
        } else if (group.regionGroupType === RegionGroupType.REGION_SERIES) {
            return group.regionGroupName.replace(/^Region Group/, "Region series");
        }
        return group.regionGroupName;
    };

    render() {
        const appStore = AppStore.Instance;
        const groups = appStore.regionGroupStores;
        const selectedRegionGroupId = groups.some(group => group.regionGroupId === this.state.selectedRegionGroupId) ? this.state.selectedRegionGroupId : groups[0]?.regionGroupId;

        return (
            <div className="region-group-manager">
                {groups.length > 0 && (
                    <Tabs selectedTabId={selectedRegionGroupId} onChange={tabId => this.selectRegionGroup(String(tabId))}>
                        {groups.map(group => (
                            <Tab key={group.regionGroupId} id={group.regionGroupId} title={this.getRegionGroupLabel(group)} panel={this.renderGroup(group)} />
                        ))}
                    </Tabs>
                )}
                {!groups.length && (
                    <ButtonGroup>
                        <Button icon="add" text="New light curve" onClick={() => this.createRegionGroup()} disabled={!appStore.timeSeriesStore.elements.length || appStore.isCurveLimitReached} />
                        <Button icon="add" text="New region series" onClick={() => this.createRegionGroup(RegionGroupType.REGION_SERIES)} disabled={!appStore.frames.length || appStore.isCurveLimitReached} />
                    </ButtonGroup>
                )}
            </div>
        );
    }
}
