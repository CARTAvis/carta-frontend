import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, HTMLSelect, IOptionProps, ButtonGroup, Button, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {SpectralProfileWidgetStore, SpectralProfilerSettingsTabs} from "stores/widgets";
import {RegionSelectorComponent} from "components";
import "./SpectralProfilerToolbarComponent.css";
import {SpectralProfilerComponent} from "../SpectralProfilerComponent";
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
    }

    private momentsShortcutClick = () => {
        this.props.widgetStore.setSettingsTabId(SpectralProfilerSettingsTabs.MOMENT);
        AppStore.Instance.widgetsStore.createFloatingSettingsWidget(SpectralProfilerComponent.WIDGET_CONFIG.title, this.props.id, SpectralProfilerComponent.WIDGET_CONFIG.type);
    }

    public render() {
        const appStore = AppStore.Instance;
        const widgetStore = this.props.widgetStore;

        let enableStatsSelect = false;
        let enableStokesSelect = false;
        let regionId = 0;
        if (appStore.activeFrame && appStore.activeFrame.regionSet) {
            let fileId = appStore.activeFrame.frameInfo.fileId;
            regionId = widgetStore.effectiveRegionId;

            const selectedRegion = appStore.activeFrame.regionSet.regions.find(r => r.regionId === regionId);
            enableStatsSelect = (selectedRegion && selectedRegion.isClosedRegion);
            enableStokesSelect = appStore.activeFrame.frameInfo.fileInfoExtended.stokes > 1;
        }

        const profileCoordinateOptions = [
            {value: "z", label: "Current"},
            {value: "Iz", label: "I"},
            {value: "Qz", label: "Q"},
            {value: "Uz", label: "U"},
            {value: "Vz", label: "V"}
        ];

        const profileStatsOptions: IOptionProps[] = [
            {value: CARTA.StatsType.Sum, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Sum)},
            {value: CARTA.StatsType.Mean, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Mean)},
            {value: CARTA.StatsType.FluxDensity, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.FluxDensity)},
            {value: CARTA.StatsType.Sigma, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Sigma)},
            {value: CARTA.StatsType.Min, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Min)},
            {value: CARTA.StatsType.Max, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Max)},
            {value: CARTA.StatsType.RMS, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.RMS)},
            {value: CARTA.StatsType.SumSq, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.SumSq)}
        ];

        return (
            <div className="spectral-profiler-toolbar">
                <RegionSelectorComponent widgetStore={widgetStore}/>
                <FormGroup label={"Statistic"} inline={true} disabled={!enableStatsSelect}>
                    <HTMLSelect value={enableStatsSelect ? widgetStore.statsType : CARTA.StatsType.Mean} options={profileStatsOptions} onChange={this.handleStatsChanged} disabled={!enableStatsSelect}/>
                </FormGroup>
                <FormGroup label={"Stokes"} inline={true} disabled={!enableStokesSelect}>
                    <HTMLSelect value={widgetStore.coordinate} options={profileCoordinateOptions} onChange={this.handleCoordinateChanged} disabled={!enableStokesSelect}/>
                </FormGroup>
                <ButtonGroup className="profile-buttons">
                    <Tooltip content="Smoothing">
                        <Button icon={<CustomIcon icon="smoothing"/>} onClick={this.smoothingShortcutClick}/>
                    </Tooltip>
                    <Tooltip content="Moments">
                        <Button icon={<CustomIcon icon="moments"/>} onClick={this.momentsShortcutClick}/>
                    </Tooltip>
                </ButtonGroup>
            </div>
        );
    }
}