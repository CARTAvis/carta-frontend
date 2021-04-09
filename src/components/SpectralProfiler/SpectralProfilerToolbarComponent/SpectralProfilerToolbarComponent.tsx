import {observer} from "mobx-react";
import * as React from "react";
import {AnchorButton, FormGroup, HTMLSelect, IOptionProps, ButtonGroup, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore, FrameStore} from "stores";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {RegionSelectorComponent, SpectralProfilerComponent, SpectralProfilerSettingsTabs} from "components";
import "./SpectralProfilerToolbarComponent.scss";
import {CustomIcon} from "icons/CustomIcons";

@observer
export class SpectralProfilerToolbarComponent extends React.Component<{ widgetStore: SpectralProfileWidgetStore, id: string }> {

    private handleStatsChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.props.widgetStore.setStatsType(parseInt(changeEvent.target.value));
    };

    private handleCoordinateChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.props.widgetStore.setCoordinate(changeEvent.target.value);
    };

    private smoothingShortcutClick = () => {
        this.props.widgetStore.setSettingsTabId(SpectralProfilerSettingsTabs.SMOOTHING);
        AppStore.Instance.widgetsStore.createFloatingSettingsWidget(SpectralProfilerComponent.WIDGET_CONFIG.title, this.props.id, SpectralProfilerComponent.WIDGET_CONFIG.type);
    };

    private momentsShortcutClick = () => {
        this.props.widgetStore.setSettingsTabId(SpectralProfilerSettingsTabs.MOMENTS);
        AppStore.Instance.widgetsStore.createFloatingSettingsWidget(SpectralProfilerComponent.WIDGET_CONFIG.title, this.props.id, SpectralProfilerComponent.WIDGET_CONFIG.type);
    };

    private fittingShortcutClick = () => {
        this.props.widgetStore.setSettingsTabId(SpectralProfilerSettingsTabs.FITTING);
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
        let stokesClassName = "unlinked-to-selected";
        let regionId = 0;
        const profileCoordinateOptions = [{value: "z", label: "Current"}];
        
        if (widgetStore.effectiveFrame && widgetStore.effectiveFrame.regionSet) {
            regionId = widgetStore.effectiveRegionId;

            const selectedRegion = widgetStore.effectiveFrame.regionSet.regions.find(r => r.regionId === regionId);
            enableStatsSelect = (selectedRegion && selectedRegion.isClosedRegion);
            enableStokesSelect = widgetStore.effectiveFrame.hasStokes;
            
            const stokesInfo = widgetStore.effectiveFrame.stokesInfo;
            stokesInfo.forEach(stokes => profileCoordinateOptions.push({value: `${stokes}z`, label: stokes}));

            const linkedClass = "linked-to-selected-stokes";
            if (enableStokesSelect && widgetStore.matchActiveFrame && (widgetStore.coordinate === stokesInfo[widgetStore.effectiveFrame.requiredStokes] + "z")) {
                stokesClassName = AppStore.Instance.darkTheme ? `${linkedClass} dark-theme` : linkedClass;
            }
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
                <RegionSelectorComponent widgetStore={widgetStore} onFrameChanged={this.handleFrameChanged}/>
                <FormGroup label={"Statistic"} inline={true} disabled={!enableStatsSelect}>
                    <HTMLSelect value={enableStatsSelect ? widgetStore.statsType : CARTA.StatsType.Mean} options={profileStatsOptions} onChange={this.handleStatsChanged} disabled={!enableStatsSelect}/>
                </FormGroup>
                <FormGroup label={"Stokes"} inline={true} disabled={!enableStokesSelect}>
                    <HTMLSelect className={stokesClassName} value={widgetStore.coordinate} options={profileCoordinateOptions} onChange={this.handleCoordinateChanged} disabled={!enableStokesSelect}/>
                </FormGroup>
                <ButtonGroup className="profile-buttons">
                    <Tooltip content="Fitting">
                        <AnchorButton icon="regression-chart" onClick={this.fittingShortcutClick}/>
                    </Tooltip>
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