import * as React from "react";
import {observer} from "mobx-react";
import {Button, Checkbox, Divider, FormGroup, HTMLSelect, NumericInput} from "@blueprintjs/core";
import {RegionSelectorComponent} from "components";
import {SpectralSettingsComponent} from "components/Shared";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {AppStore} from "stores";
import "./MomentGeneratorComponent.css";

export enum Moments {
    TYPE_M1 = "-1: Mean value of the spectrum",
    TYPE_0 = "0: Integrated value of the spectrum",
    TYPE_1 = "1: Intensity weighted coordinate",
    TYPE_2 = "2: Intensity weighted dispersion of the coordinate",
    TYPE_3 = "3: Median value of the spectrum",
    TYPE_4 = "4: Median coordinate",
    TYPE_5 = "5: Standard deviation about the mean of the spectrum",
    TYPE_6 = "6: Root mean square of the spectrum",
    TYPE_7 = "7: Absolute mean deviation of the spectrum",
    TYPE_8 = "8: Maximum value of the spectrum",
    TYPE_9 = "9: Coordinate of the maximum value of the spectrum",
    TYPE_10 = "10: Minimum value of the spectrum",
    TYPE_11 = "11: Coordinate of the minimum value of the spectrum"
}

@observer
export class MomentGeneratorComponent extends React.Component<{appStore: AppStore, widgetStore: SpectralProfileWidgetStore}> {
    private handleMomentGenerate = () => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame) {
            appStore.generateMoment(appStore.activeFrame.frameInfo.fileId);
        }
    };

    render() {
        const regionPanel = <RegionSelectorComponent appStore={this.props.appStore} widgetStore={this.props.widgetStore}/>;

        const spectralPanel = (
            <React.Fragment>
                <SpectralSettingsComponent appStore={this.props.appStore} widgetStore={this.props.widgetStore} disable={false}/>
                <FormGroup label="From" inline={true}>
                    <NumericInput
                        value={0}
                        selectAllOnFocus={true}
                        buttonPosition={"none"}
                        allowNumericCharactersOnly={true}
                    />
                </FormGroup>
                <FormGroup label="To" inline={true}>
                    <NumericInput
                        value={0}
                        selectAllOnFocus={true}
                        buttonPosition={"none"}
                        allowNumericCharactersOnly={true}
                    />
                </FormGroup>
                <FormGroup inline={true} className="reset-range-content">
                    <Button className="cursor-selection" small={true} >Cursor selection</Button>
                </FormGroup>
            </React.Fragment>
        );

        const maskPanel = (
            <React.Fragment>
                <FormGroup label="Mask" inline={true}>
                    <HTMLSelect
                        value={"None"}
                        options={["None", "Include", "Exclude"]}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => {}}
                    />
                </FormGroup>
                <FormGroup label="From" inline={true}>
                    <NumericInput
                        value={0}
                        selectAllOnFocus={true}
                        buttonPosition={"none"}
                        allowNumericCharactersOnly={true}
                    />
                </FormGroup>
                <FormGroup label="To" inline={true}>
                    <NumericInput
                        value={0}
                        selectAllOnFocus={true}
                        buttonPosition={"none"}
                        allowNumericCharactersOnly={true}
                    />
                </FormGroup>
            </React.Fragment>
        );

        const momentsPanel = (
            <React.Fragment>
                {Object.values(Moments).map((momentType) => <Checkbox key={momentType} checked={false} label={momentType} onChange={() => {}}/>)}
                <div className="moment-generate">
                    <Button intent="success" onClick={this.handleMomentGenerate}>Generate</Button>
                </div>
            </React.Fragment>
        );

        return (
            <div className="moment-generator">
                <div className="panel-left">
                    {regionPanel}
                    <Divider/>
                    {spectralPanel}
                    <Divider/>
                    {maskPanel}
                </div>
                <div className="panel-right">
                    {momentsPanel}
                </div>
            </div>
        );
    }
}
