import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, HTMLSelect, IOptionProps, Switch} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {StokesAnalysisWidgetStore} from "stores/widgets";
import "./StokesAnalysisToolbarComponent.css";

@observer
export class StokesAnalysisToolbarComponent extends React.Component<{widgetStore: StokesAnalysisWidgetStore, appStore: AppStore}> {


    public render() {
        const appStore = this.props.appStore;
        const widgetStore = this.props.widgetStore;

        let enableStatsSelect = false;
        let enableRegionSelect = false;
        let enableStokesSelect = false;
        let enableFractionalPol = false;
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
        }

        // add new stoket plot type PA, PI, Q+U (multiple lines), Q vs U (Scatter plot)
        const profileCoordinateOptions = [
            {value: "z", label: "Current"},
        ];

        const profileStatsOptions: IOptionProps[] = [
            {value: CARTA.StatsType.Sum, label: "Mean"},
        ];

        return (
            <div className="stokes-analysis-toolbar">
                <FormGroup label={"Region"} inline={true} disabled={!enableRegionSelect}>
                    <HTMLSelect value={regionId} options={profileRegionOptions} disabled={!enableRegionSelect}/>
                </FormGroup>
                <FormGroup label={"Statistic"} inline={true} disabled={!enableStatsSelect}>
                    <HTMLSelect value={widgetStore.statsType} options={profileStatsOptions} disabled={!enableStatsSelect}/>
                </FormGroup>
                <FormGroup label={"Stokes"} inline={true} disabled={!enableStokesSelect}>
                    <HTMLSelect value={"Toolbar Placeholder"} options={profileCoordinateOptions} disabled={!enableStokesSelect}/>
                </FormGroup>
                <FormGroup label={"Frac. Pol."} inline={true}>
                    <Switch checked={widgetStore.fractionalPolVisible} disabled={!enableFractionalPol}/>
                </FormGroup>
            </div>
        );
    }
}