import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, HTMLSelect, IOptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {SpectralProfileWidgetStore} from "stores/widgets";
import "./SpectralProfilerToolbarComponent.css";
import {StokesCoordinate, StokesCoordinateLabel} from "stores/widgets/SpectralProfileWidgetStore";

@observer
export class SpectralProfilerToolbarComponent extends React.Component<{widgetStore: SpectralProfileWidgetStore, appStore: AppStore}> {

    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        if (this.props.appStore.activeFrame) {
            this.props.widgetStore.setRegionId(this.props.appStore.activeFrame.frameInfo.fileId, parseInt(changeEvent.target.value));
        }
    };

    private handleStatsChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.props.widgetStore.setStatsType(parseInt(changeEvent.target.value));
    };

    private handleCoordinateChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        let targetValue = Object.values(StokesCoordinate).find(values => values === changeEvent.target.value);
        this.props.widgetStore.setCoordinate(targetValue);
        // set stats back to "Mean", if stokes is PI or PA
        if (targetValue === StokesCoordinate.PolarizedIntensity || targetValue === StokesCoordinate.PolarizationAngle) {
            this.props.widgetStore.setStatsType(CARTA.StatsType.Mean);
        }
    };

    public render() {
        const appStore = this.props.appStore;
        const widgetStore = this.props.widgetStore;

        let enableStatsSelect = false;
        let enableRegionSelect = false;
        let enableStokesSelect = false;
        let regionId = 0;
        // Fill region select options with all non-temporary regions that are closed or point type
        let profileRegionOptions: IOptionProps[];
        if (appStore.activeFrame && appStore.activeFrame.regionSet) {
            let fileId = appStore.activeFrame.frameInfo.fileId;
            regionId = widgetStore.regionIdMap.get(fileId) || 0;
            profileRegionOptions = appStore.activeFrame.regionSet.regions.filter(r => !r.isTemporary && (r.isClosedRegion || r.regionType === CARTA.RegionType.POINT)).map(r => {
                return {
                    value: r.regionId,
                    label: r.nameString
                };
            });

            const selectedRegion = appStore.activeFrame.regionSet.regions.find(r => r.regionId === regionId);
            // Disable stats change for PI and PA
            enableStatsSelect = (
                selectedRegion && selectedRegion.isClosedRegion 
                && widgetStore.coordinate !== StokesCoordinate.PolarizedIntensity 
                && widgetStore.coordinate !== StokesCoordinate.PolarizationAngle
            );
            enableRegionSelect = profileRegionOptions.length > 1;
            enableStokesSelect = appStore.activeFrame.frameInfo.fileInfoExtended.stokes > 1;
        }

        // add new stoket plot type PA, PI, Q+U (multiple lines), Q vs U (Scatter plot)
        const profileCoordinateOptions = [
            {value: StokesCoordinate.CurrentZ, label: StokesCoordinateLabel.CurrentZLabel},
            {value: StokesCoordinate.TotalIntensity, label: StokesCoordinateLabel.TotalIntensityLabel},
            {value: StokesCoordinate.LinearPolarizationQ, label: StokesCoordinateLabel.LinearPolarizationQLabel},
            {value: StokesCoordinate.LinearPolarizationU, label: StokesCoordinateLabel.LinearPolarizationULabel},
            {value: StokesCoordinate.CircularPolarization, label: StokesCoordinateLabel.CircularPolarizationLabel},
            {value: StokesCoordinate.PolarizedIntensity, label: StokesCoordinateLabel.PolarizedIntensityLabel},
            {value: StokesCoordinate.PolarizationAngle, label: StokesCoordinateLabel.PolarizationAngleLabel},
        ];

        const profileStatsOptions: IOptionProps[] = [
            {value: CARTA.StatsType.Sum, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Sum)},
            {value: CARTA.StatsType.Mean, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Mean)},
            {value: CARTA.StatsType.Sigma, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Sigma)},
            {value: CARTA.StatsType.Min, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Min)},
            {value: CARTA.StatsType.Max, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.Max)},
            {value: CARTA.StatsType.RMS, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.RMS)},
            {value: CARTA.StatsType.SumSq, label: SpectralProfileWidgetStore.StatsTypeString(CARTA.StatsType.SumSq)}
        ];

        return (
            <div className="spectral-profiler-toolbar">
                <FormGroup label={"Region"} inline={true} disabled={!enableRegionSelect}>
                    <HTMLSelect value={regionId} options={profileRegionOptions} onChange={this.handleRegionChanged} disabled={!enableRegionSelect}/>
                </FormGroup>
                <FormGroup label={"Statistic"} inline={true} disabled={!enableStatsSelect}>
                    <HTMLSelect value={widgetStore.statsType} options={profileStatsOptions} onChange={this.handleStatsChanged} disabled={!enableStatsSelect}/>
                </FormGroup>
                <FormGroup label={"Stokes"} inline={true} disabled={!enableStokesSelect}>
                    <HTMLSelect value={widgetStore.coordinate} options={profileCoordinateOptions} onChange={this.handleCoordinateChanged} disabled={!enableStokesSelect}/>
                </FormGroup>
            </div>
        );
    }
}