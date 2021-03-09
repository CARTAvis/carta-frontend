import {observer} from "mobx-react";
import * as React from "react";
import {AnchorButton, ButtonGroup, IOptionProps, Menu, MenuItem, Popover, Position, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore, FrameStore} from "stores";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {SpectralProfilerComponent, SpectralProfilerSettingsTabs} from "components";
import "./SpectralProfilerToolbarComponent.scss";
import {CustomIcon} from "icons/CustomIcons";

@observer
export class SpectralProfilerToolbarComponent extends React.Component<{ widgetStore: SpectralProfileWidgetStore, id: string }> {
    private onStatsItemClick = (ev) => {
        this.props.widgetStore.selectStatsType(parseInt(ev.target.value));
    };

    private onStokesItemClick = (ev) => {
        this.props.widgetStore.selectCoordinate(ev.target.value);
    };

    private smoothingShortcutClick = () => {
        this.props.widgetStore.setSettingsTabId(SpectralProfilerSettingsTabs.SMOOTHING);
        AppStore.Instance.widgetsStore.createFloatingSettingsWidget(SpectralProfilerComponent.WIDGET_CONFIG.title, this.props.id, SpectralProfilerComponent.WIDGET_CONFIG.type);
    };

    private momentsShortcutClick = () => {
        this.props.widgetStore.setSettingsTabId(SpectralProfilerSettingsTabs.MOMENTS);
        AppStore.Instance.widgetsStore.createFloatingSettingsWidget(SpectralProfilerComponent.WIDGET_CONFIG.title, this.props.id, SpectralProfilerComponent.WIDGET_CONFIG.type);
    };

    private handleFrameChanged = (newFrame: FrameStore) => {
        if (newFrame && !newFrame.stokesInfo.includes(this.props.widgetStore.coordinate)) {
            this.props.widgetStore.setCoordinate("z");
        }
    };

    public render() {
        const widgetStore = this.props.widgetStore;

        let enableStatsSelect = false;
        let enableStokesSelect = false;
        let regionId = 0;
        const profileCoordinateOptions = [{value: "z", label: "Current"}];
        
        if (widgetStore.effectiveFrame && widgetStore.effectiveFrame.regionSet) {
            regionId = widgetStore.effectiveRegionId;

            const selectedRegion = widgetStore.effectiveFrame.regionSet.regions.find(r => r.regionId === regionId);
            enableStatsSelect = (selectedRegion && selectedRegion.isClosedRegion);
            enableStokesSelect = widgetStore.effectiveFrame.hasStokes;
            
            const stokesInfo = widgetStore.effectiveFrame.stokesInfo;
            stokesInfo.forEach(stokes => profileCoordinateOptions.push({value: `${stokes}z`, label: stokes}));
        }

        const profileStatsOptions: IOptionProps[] = [
            {value: CARTA.StatsType.Sum, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Sum)},
            {value: CARTA.StatsType.Mean, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Mean)},
            {value: CARTA.StatsType.FluxDensity, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.FluxDensity)},
            {value: CARTA.StatsType.Sigma, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Sigma)},
            {value: CARTA.StatsType.Min, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Min)},
            {value: CARTA.StatsType.Max, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Max)},
            {value: CARTA.StatsType.Extrema, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Extrema)},
            {value: CARTA.StatsType.RMS, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.RMS)},
            {value: CARTA.StatsType.SumSq, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.SumSq)}
        ];

        return (
            <div className="spectral-profiler-toolbar">
                <Tooltip content="Select images to show multiple profiles" position={Position.TOP}>
                    <Popover
                        content={<Menu></Menu>}
                        position={Position.BOTTOM}
                        disabled={true}
                    >
                        <AnchorButton className="profile-buttons" rightIcon="caret-down" text="Image" disabled={true}/>
                    </Popover>
                </Tooltip>
                <Tooltip content="Select regions to show multiple profiles" position={Position.TOP}>
                    <Popover
                        content={<Menu></Menu>}
                        position={Position.BOTTOM}
                        disabled={true}
                    >
                        <AnchorButton className="profile-buttons" rightIcon="caret-down" text="Region" disabled={true}/>
                    </Popover>
                </Tooltip>
                <Tooltip content="Select statistics to show multiple profiles" position={Position.TOP}>
                    <Popover
                        content={
                            <Menu>
                                {profileStatsOptions?.map((item) =>
                                    <MenuItem key={item?.label} text={item?.label} onClick={this.onStatsItemClick} icon={this.props.widgetStore.isStatsTypeSelected(item.value as CARTA.StatsType) ? "tick" : "blank"}/>
                                )}
                            </Menu>
                        }
                        position={Position.BOTTOM}
                        disabled={!enableStatsSelect}
                    >
                        <AnchorButton className="profile-buttons" rightIcon="caret-down" text="Statistics" disabled={!enableStatsSelect}/>
                    </Popover>
                </Tooltip>
                <Tooltip content="Select stokes to show multiple profiles" position={Position.TOP}>
                    <Popover
                        content={
                            <Menu>
                                {profileCoordinateOptions?.map((item) =>
                                    <MenuItem key={item?.label} text={item?.label} onClick={this.onStokesItemClick} icon={this.props.widgetStore.isCoordinateSelected(item.value) ? "tick" : "blank"}/>
                                )}
                            </Menu>
                        }
                        position={Position.BOTTOM}
                        disabled={!enableStokesSelect}
                    >
                        <AnchorButton className="profile-buttons" rightIcon="caret-down" text="Stokes" disabled={!enableStokesSelect}/>
                    </Popover>
                </Tooltip>
                <ButtonGroup className="profile-buttons">
                    <Tooltip content="Smoothing">
                        <AnchorButton icon={<CustomIcon icon="smoothing"/>} onClick={this.smoothingShortcutClick}/>
                    </Tooltip>
                    <Tooltip content="Moments">
                        <AnchorButton icon={<CustomIcon icon="moments"/>} onClick={this.momentsShortcutClick}/>
                    </Tooltip>
                </ButtonGroup>
            </div>
        );
    }
}