import * as React from "react";
import {observer} from "mobx-react";
import {CARTA} from "carta-protobuf";
import {Button, ControlGroup, FormGroup, HTMLSelect, IOptionProps, Switch} from "@blueprintjs/core";
import {PlotTypeSelectorComponent} from "components/Shared";
import {AppStore} from "stores";
import {SpectralProfileWidgetStore} from "stores/widgets";
import "./SpectralProfilerSettingsPanelComponent.css";

@observer
export class SpectralProfilerSettingsPanelComponent extends React.Component<{ appStore: AppStore, widgetStore: SpectralProfileWidgetStore }> {

    handleMeanRmsChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setMeanRmsVisible(changeEvent.target.checked);
    };

    handleWcsValuesChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setUseWcsValues(changeEvent.target.checked);
    };

    handleCoordinateChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.props.widgetStore.setCoordinate(changeEvent.target.value);
    };

    handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.props.widgetStore.setRegionId(parseInt(changeEvent.target.value));
    };

    handleStatsChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.props.widgetStore.setStatsType(parseInt(changeEvent.target.value));
    };

    render() {
        const widgetStore = this.props.widgetStore;
        const appStore = this.props.appStore;
        const profileCoordinateOptions = [
            {value: "z", label: "Current"},
            {value: "Iz", label: "I"},
            {value: "Qz", label: "Q"},
            {value: "Uz", label: "U"},
            {value: "Vz", label: "V"}
        ];

        // Fill region select options with all non-temporary regions that are closed or point type
        let profileRegionOptions: IOptionProps[];
        if (this.props.appStore.activeFrame && this.props.appStore.activeFrame.regionSet) {
            profileRegionOptions = this.props.appStore.activeFrame.regionSet.regions.filter(r => !r.isTemporary && (r.isClosedRegion || r.regionType === CARTA.RegionType.POINT)).map(r => {
                return {
                    value: r.regionId,
                    label: r.nameString
                };
            });
        }

        let showStatsType = false;
        if (appStore.activeFrame) {
            const selectedRegion = appStore.activeFrame.regionSet.regions.find(r => r.regionId === widgetStore.regionId);
            showStatsType = (selectedRegion && selectedRegion.isClosedRegion);
        }

        const profileStatsOptions: IOptionProps[] = [
            {value: CARTA.StatsType.Sum, label: "Sum"},
            {value: CARTA.StatsType.FluxDensity, label: "Flux Density"},
            {value: CARTA.StatsType.Mean, label: "Mean"},
            {value: CARTA.StatsType.RMS, label: "RMS"},
            {value: CARTA.StatsType.Sigma, label: "Sigma"},
            {value: CARTA.StatsType.SumSq, label: "SumSq"},
            {value: CARTA.StatsType.Min, label: "Min"},
            {value: CARTA.StatsType.Max, label: "Max"},
        ];

        return (
            <React.Fragment>
                <FormGroup className={"spectral-profile-settings-panel-form"}>
                    <ControlGroup fill={true} vertical={true}>
                        <FormGroup label={"Stokes"} inline={true}>
                            <HTMLSelect value={widgetStore.coordinate} options={profileCoordinateOptions} onChange={this.handleCoordinateChanged}/>
                        </FormGroup>
                        <FormGroup label={"Region"} inline={true}>
                            <HTMLSelect value={widgetStore.regionId} options={profileRegionOptions} onChange={this.handleRegionChanged}/>
                        </FormGroup>
                        {showStatsType &&
                        <FormGroup label={"Stats"} inline={true}>
                            <HTMLSelect value={widgetStore.statsType} options={profileStatsOptions} onChange={this.handleStatsChanged}/>
                        </FormGroup>
                        }
                        <Switch label={"Use WCS Values"} checked={widgetStore.useWcsValues} onChange={this.handleWcsValuesChanged}/>
                        <Switch label={"Show Mean/RMS"} checked={widgetStore.meanRmsVisible} onChange={this.handleMeanRmsChanged}/>
                        <PlotTypeSelectorComponent value={widgetStore.plotType} onValueChanged={widgetStore.setPlotType}/>
                        <Button icon={"zoom-to-fit"} small={true} disabled={widgetStore.isAutoScaledX && widgetStore.isAutoScaledY} onClick={widgetStore.clearXYBounds}>Reset Range</Button>
                    </ControlGroup>
                </FormGroup>
            </React.Fragment>
        );
    }
}