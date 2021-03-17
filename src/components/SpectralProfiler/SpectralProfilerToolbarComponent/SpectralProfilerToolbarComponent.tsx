import {observer} from "mobx-react";
import * as React from "react";
import {AnchorButton, ButtonGroup, IOptionProps, Position, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore, FrameStore} from "stores";
import {ProfileClass, SpectralProfileWidgetStore} from "stores/widgets";
import {SpectralProfilerComponent, SpectralProfilerSettingsTabs} from "components";
import {MultiSelectButtonComponent} from "./MultiSelectButtonComponent";
import {CustomIcon} from "icons/CustomIcons";
import "./SpectralProfilerToolbarComponent.scss";

@observer
export class SpectralProfilerToolbarComponent extends React.Component<{ widgetStore: SpectralProfileWidgetStore, id: string }> {
    private onFrameItemClick = (selectedFrame: number) => {
        this.props.widgetStore.selectFrame(selectedFrame);
    };

    private onRegionItemClick = (selectedRegion: number) => {
        this.props.widgetStore.selectRegion(selectedRegion);
    };

    private onStatsItemClick = (selectedStatsType: CARTA.StatsType) => {
        this.props.widgetStore.selectStatsType(selectedStatsType);
    };

    private onStokesItemSelect = (selectedStokes: string) => {
        this.props.widgetStore.selectCoordinate(selectedStokes);
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

        let enableFrameSelect = true;
        let enableRegionSelect = true;
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
                <Tooltip content="Select to show multiple profiles" position={Position.TOP}>
                    <AnchorButton
                        text={ProfileClass.IMAGE}
                        active={widgetStore.selectedProfileClass === ProfileClass.IMAGE}
                        onClick={(ev) => widgetStore.selectProfileClass(ProfileClass.IMAGE)}
                    />
                </Tooltip>
                <MultiSelectButtonComponent
                    itemOptions={AppStore.Instance.frameNames}
                    itemSelected={widgetStore.selectedFrames}
                    onItemSelect={this.onFrameItemClick}
                    disabled={!enableFrameSelect}
                />
                <Tooltip content="Select to show multiple profiles" position={Position.TOP}>
                    <AnchorButton
                        text={ProfileClass.REGION}
                        active={widgetStore.selectedProfileClass === ProfileClass.REGION}
                        onClick={(ev) => widgetStore.selectProfileClass(ProfileClass.REGION)}
                    />
                </Tooltip>
                <MultiSelectButtonComponent
                    itemOptions={undefined}
                    itemSelected={widgetStore.selectedRegions}
                    onItemSelect={this.onRegionItemClick}
                    disabled={!enableRegionSelect}
                />
                <Tooltip content="Select to show multiple profiles" position={Position.TOP}>
                    <AnchorButton
                        text={ProfileClass.STATISTICS}
                        active={widgetStore.selectedProfileClass === ProfileClass.STATISTICS}
                        onClick={(ev) => widgetStore.selectProfileClass(ProfileClass.STATISTICS)}
                        disabled={!enableStatsSelect}
                    />
                </Tooltip>
                <MultiSelectButtonComponent
                    itemOptions={profileStatsOptions}
                    itemSelected={widgetStore.selectedStatsTypes}
                    onItemSelect={this.onStatsItemClick}
                    disabled={!enableStatsSelect}
                />
                <Tooltip content="Select to show multiple profiles" position={Position.TOP}>
                    <AnchorButton
                        text={ProfileClass.STOKES}
                        active={widgetStore.selectedProfileClass === ProfileClass.STOKES}
                        onClick={(ev) => widgetStore.selectProfileClass(ProfileClass.STOKES)}
                        disabled={!enableStokesSelect}
                    />
                </Tooltip>
                <MultiSelectButtonComponent
                    itemOptions={profileCoordinateOptions}
                    itemSelected={widgetStore.selectedCoordinates}
                    onItemSelect={this.onStokesItemSelect}
                    disabled={!enableStokesSelect}
                />
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