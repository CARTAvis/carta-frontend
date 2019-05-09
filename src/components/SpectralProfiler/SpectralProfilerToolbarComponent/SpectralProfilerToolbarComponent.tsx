import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, HTMLSelect, IOptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {SpectralProfileWidgetStore} from "stores/widgets";
import "./SpectralProfilerToolbarComponent.css";

@observer
export class SpectralProfilerToolbarComponent extends React.Component<{ widgetStore: SpectralProfileWidgetStore, appStore: AppStore }> {

    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        if (this.props.appStore.activeFrame) {
            this.props.widgetStore.setRegionId(this.props.appStore.activeFrame.frameInfo.fileId, parseInt(changeEvent.target.value));
        }
    };

    private handleStatsChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.props.widgetStore.setStatsType(parseInt(changeEvent.target.value));
    };

    private handleCoordinateChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.props.widgetStore.setCoordinate(changeEvent.target.value);
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
            enableStatsSelect = (selectedRegion && selectedRegion.isClosedRegion);
            enableRegionSelect = profileRegionOptions.length > 1;
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