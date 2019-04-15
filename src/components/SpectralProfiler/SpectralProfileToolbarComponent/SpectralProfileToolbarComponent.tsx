import {observer} from "mobx-react";
import * as React from "react";
import {ControlGroup, FormGroup, HTMLSelect, IOptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {SpectralProfileWidgetStore} from "stores/widgets";
import "./SpectralProfileToolbarComponent.css";

@observer
export class SpectralProfileToolbarComponent extends React.Component<{widgetStore: SpectralProfileWidgetStore, appStore: AppStore }> {

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
        }

        const profileCoordinateOptions = [
            {value: "z", label: "Current"},
            {value: "Iz", label: "I"},
            {value: "Qz", label: "Q"},
            {value: "Uz", label: "U"},
            {value: "Vz", label: "V"}
        ];

        let showStatsType = false;
        if (appStore.activeFrame) {
            const selectedRegion = appStore.activeFrame.regionSet.regions.find(r => r.regionId === regionId);
            showStatsType = (selectedRegion && selectedRegion.isClosedRegion);
        }

        const profileStatsOptions: IOptionProps[] = [
            {value: CARTA.StatsType.Sum, label: "Sum"},
            {value: CARTA.StatsType.Mean, label: "Mean"},
            {value: CARTA.StatsType.RMS, label: "RMS"},
            {value: CARTA.StatsType.Sigma, label: "Sigma"},
            {value: CARTA.StatsType.SumSq, label: "SumSq"},
            {value: CARTA.StatsType.Min, label: "Min"},
            {value: CARTA.StatsType.Max, label: "Max"},
        ];

        return (
            <div className="spectral-profiler-toolbar">
                <FormGroup label={"Region"} inline={true}>
                    <HTMLSelect value={regionId} options={profileRegionOptions} onChange={this.handleRegionChanged}/>
                </FormGroup>
                <FormGroup label={"Stokes"} inline={true}>
                    <HTMLSelect value={widgetStore.coordinate} options={profileCoordinateOptions} onChange={this.handleCoordinateChanged}/>
                </FormGroup>
                {showStatsType &&
                <FormGroup label={"Statistic"} inline={true}>
                    <HTMLSelect value={widgetStore.statsType} options={profileStatsOptions} onChange={this.handleStatsChanged}/>
                </FormGroup>
                }
            </div>
        );
    }
}