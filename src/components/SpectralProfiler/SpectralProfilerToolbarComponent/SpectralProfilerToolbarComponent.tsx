import {observer} from "mobx-react";
import * as React from "react";
import {AnchorButton, ButtonGroup, IOptionProps, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {ProfileCategory, SpectralProfileWidgetStore} from "stores/widgets";
import {SpectralProfilerComponent, SpectralProfilerSettingsTabs} from "components";
import {ProfileSelectionComponent} from "./ProfileSelectionComponent";
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

    private onStokesItemClick = (selectedStokes: string) => {
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
                <ProfileSelectionComponent
                    category={ProfileCategory.IMAGE}
                    selectedCategory={widgetStore.selectedProfileCategory}
                    itemOptions={AppStore.Instance.frameNames}
                    itemSelected={[widgetStore.selectedFrame]}
                    disabled={!enableFrameSelect}
                    onCategorySelect={() => widgetStore.selectProfileCategory(ProfileCategory.IMAGE)}
                    onItemSelect={this.onFrameItemClick}
                />
                <ProfileSelectionComponent
                    category={ProfileCategory.REGION}
                    selectedCategory={widgetStore.selectedProfileCategory}
                    itemOptions={undefined}
                    itemSelected={widgetStore.selectedRegions}
                    disabled={!enableRegionSelect}
                    onCategorySelect={() => widgetStore.selectProfileCategory(ProfileCategory.REGION)}
                    onItemSelect={this.onRegionItemClick}
                />
                <ProfileSelectionComponent
                    category={ProfileCategory.STATISTICS}
                    selectedCategory={widgetStore.selectedProfileCategory}
                    itemOptions={profileStatsOptions}
                    itemSelected={widgetStore.selectedStatsTypes}
                    disabled={!enableStatsSelect}
                    onCategorySelect={() => widgetStore.selectProfileCategory(ProfileCategory.STATISTICS)}
                    onItemSelect={this.onStatsItemClick}
                />
                <ProfileSelectionComponent
                    category={ProfileCategory.STOKES}
                    selectedCategory={widgetStore.selectedProfileCategory}
                    itemOptions={profileCoordinateOptions}
                    itemSelected={widgetStore.selectedCoordinates}
                    disabled={!enableStokesSelect}
                    onCategorySelect={() => widgetStore.selectProfileCategory(ProfileCategory.STOKES)}
                    onItemSelect={this.onStokesItemClick}
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
