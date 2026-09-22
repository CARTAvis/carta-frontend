import * as React from "react";
import {Button, ButtonGroup, FormGroup, HTMLSelect, Icon, InputGroup, Position, Tab, Tabs, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {observer} from "mobx-react";

import {RegionGroupType} from "enums";
import {AppStore, type DefaultWidgetConfig, type RegionGroupStore, type WidgetProps} from "stores";
import {type FrameStore} from "stores/Frame";

import "./RegionGroupManagerComponent.scss";

@observer
export class RegionGroupManagerComponent extends React.Component<WidgetProps, {selectedRegionGroupId?: string}> {
    public static get WidgetConfig(): DefaultWidgetConfig {
        return {
            id: "sequential-profiler-floating-settings",
            type: "floating-settings",
            minWidth: 400,
            minHeight: 300,
            defaultWidth: 500,
            defaultHeight: 550,
            title: "Light curve management",
            isCloseable: true,
            parentId: "sequential-profiler",
            parentType: "sequential-profiler"
        };
    }

    constructor(props: WidgetProps) {
        super(props);
        this.state = {};
    }

    private selectRegionGroup = (regionGroupId: string) => {
        this.setState({selectedRegionGroupId: regionGroupId});
    };

    private createRegionGroup = () => {
        this.setState({selectedRegionGroupId: AppStore.Instance.createRegionGroup().regionGroupId});
    };

    private deleteRegionGroup = (regionGroup: RegionGroupStore) => {
        const appStore = AppStore.Instance;
        const groups = appStore.regionGroupStores;
        const deletedIndex = groups.findIndex(group => group.regionGroupId === regionGroup.regionGroupId);
        appStore.deleteRegionGroup(regionGroup.regionGroupId);
        this.setState({selectedRegionGroupId: groups[deletedIndex + 1]?.regionGroupId ?? groups[deletedIndex - 1]?.regionGroupId});
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
            regionMean: regionStats?.statistics?.find(stat => stat.statsType === CARTA.StatsType.Mean)?.value ?? undefined
        });
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

    private renderGroup = (regionGroup: RegionGroupStore) => {
        const appStore = AppStore.Instance;
        const groupName = regionGroup.regionGroupType === RegionGroupType.TIME_SERIES ? regionGroup.regionGroupName.replace(/^Region Group/, "Light curve") : regionGroup.regionGroupName;
        return (
            <div className="region-group-panel">
                <FormGroup label="Name">
                    <InputGroup value={groupName} onChange={event => regionGroup.setName(event.currentTarget.value)} />
                </FormGroup>
                <FormGroup label="Type" inline={true}>
                    <HTMLSelect value={regionGroup.regionGroupType} options={Object.values(RegionGroupType)} onChange={event => regionGroup.setType(event.currentTarget.value as RegionGroupType)} />
                </FormGroup>
                {appStore.timeSeriesStore.elements.map(({frame}) => this.renderFrame(regionGroup, frame))}
                <ButtonGroup>
                    <Button icon="add" text="New light curve" onClick={this.createRegionGroup} />
                    <Button icon="trash" text="Delete" onClick={() => this.deleteRegionGroup(regionGroup)} />
                </ButtonGroup>
            </div>
        );
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
                            <Tab
                                key={group.regionGroupId}
                                id={group.regionGroupId}
                                title={group.regionGroupType === RegionGroupType.TIME_SERIES ? group.regionGroupName.replace(/^Region Group/, "Light curve") : group.regionGroupName}
                                panel={this.renderGroup(group)}
                            />
                        ))}
                    </Tabs>
                )}
                {!groups.length && <Button icon="add" text="New light curve" onClick={this.createRegionGroup} />}
            </div>
        );
    }
}
