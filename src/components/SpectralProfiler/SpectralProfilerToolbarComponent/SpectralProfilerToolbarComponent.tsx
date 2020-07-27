import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, HTMLSelect, IOptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore, FrameStore} from "stores";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {RegionSelectorComponent} from "components";
import "./SpectralProfilerToolbarComponent.css";

@observer
export class SpectralProfilerToolbarComponent extends React.Component<{ widgetStore: SpectralProfileWidgetStore }> {

    private handleStatsChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.props.widgetStore.setStatsType(parseInt(changeEvent.target.value));
    };

    private handleCoordinateChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.props.widgetStore.setCoordinate(changeEvent.target.value);
    };

    private handleFrameChanged = (newFrame: FrameStore) => {
        if (newFrame && !newFrame.stokesInfo.includes(this.props.widgetStore.coordinate)) {
            this.props.widgetStore.setCoordinate("z");
        }
    }

    public render() {
        const widgetStore = this.props.widgetStore;

        let enableStatsSelect = false;
        let enableStokesSelect = false;
        let stokesClassName = "";
        let regionId = 0;
        const profileCoordinateOptions = [{value: "z", label: "Current"}];
        
        if (widgetStore.effectiveFrame && widgetStore.effectiveFrame.regionSet) {
            regionId = widgetStore.effectiveRegionId;

            const selectedRegion = widgetStore.effectiveFrame.regionSet.regions.find(r => r.regionId === regionId);
            enableStatsSelect = (selectedRegion && selectedRegion.isClosedRegion);
            enableStokesSelect = widgetStore.effectiveFrame.hasStokes;
            
            const stokesInfo = widgetStore.effectiveFrame.stokesInfo;
            stokesInfo.forEach(stokes => profileCoordinateOptions.push({value: `${stokes}z`, label: stokes}));

            const linkedClass = "linked-to-selected";
            if (enableStokesSelect && widgetStore.matchActiveFrame && (widgetStore.coordinate === "z" || widgetStore.coordinate === stokesInfo[widgetStore.effectiveFrame.requiredStokes] + "z")) {
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
            </div>
        );
    }
}