import * as React from "react";
import {observer} from "mobx-react";
import {Button, Checkbox, Divider, FormGroup, HTMLSelect, NumericInput} from "@blueprintjs/core";
import {RegionSelectorComponent} from "components";
import {SpectralSettingsComponent} from "components/Shared";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {AppStore} from "stores";
import {MomentMask, Moments} from "models";
import "./MomentGeneratorComponent.css";

@observer
export class MomentGeneratorComponent extends React.Component<{appStore: AppStore, widgetStore: SpectralProfileWidgetStore}> {
    private handleMomentGenerate = () => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame) {
            appStore.generateMoment(appStore.activeFrame.frameInfo.fileId);
        }
    };

    render() {
        const appStore = this.props.appStore;
        const widgetStore = this.props.widgetStore;
        const regionPanel = <RegionSelectorComponent appStore={this.props.appStore} widgetStore={this.props.widgetStore}/>;

        const spectralPanel = (
            <React.Fragment>
                <SpectralSettingsComponent appStore={this.props.appStore} widgetStore={this.props.widgetStore} disable={false}/>
                <FormGroup label="From" inline={true} disabled={!appStore.activeFrame}>
                    <NumericInput
                        value={0}
                        selectAllOnFocus={true}
                        buttonPosition={"none"}
                        allowNumericCharactersOnly={true}
                        disabled={!appStore.activeFrame}
                    />
                </FormGroup>
                <FormGroup label="To" inline={true} disabled={!appStore.activeFrame}>
                    <NumericInput
                        value={0}
                        selectAllOnFocus={true}
                        buttonPosition={"none"}
                        allowNumericCharactersOnly={true}
                        disabled={!appStore.activeFrame}
                    />
                </FormGroup>
                <FormGroup inline={true} className="reset-range-content" disabled={!appStore.activeFrame}>
                    <Button className="cursor-selection" small={true} disabled={!appStore.activeFrame}>Cursor selection</Button>
                </FormGroup>
            </React.Fragment>
        );

        const maskPanel = (
            <React.Fragment>
                <FormGroup label="Mask" inline={true} disabled={!appStore.activeFrame}>
                    <HTMLSelect
                        value={widgetStore.momentMask}
                        options={Object.keys(MomentMask).map((key) => ({label: MomentMask[key], value: key}))}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => widgetStore.setMomentMask(event.currentTarget.value as MomentMask)}
                        disabled={!appStore.activeFrame}
                    />
                </FormGroup>
                <FormGroup label="From" inline={true} disabled={!appStore.activeFrame}>
                    <NumericInput
                        value={0}
                        selectAllOnFocus={true}
                        buttonPosition={"none"}
                        allowNumericCharactersOnly={true}
                        disabled={!appStore.activeFrame}
                    />
                </FormGroup>
                <FormGroup label="To" inline={true} disabled={!appStore.activeFrame}>
                    <NumericInput
                        value={0}
                        selectAllOnFocus={true}
                        buttonPosition={"none"}
                        allowNumericCharactersOnly={true}
                        disabled={!appStore.activeFrame}
                    />
                </FormGroup>
            </React.Fragment>
        );

        const momentsPanel = (
            <React.Fragment>
                {Object.keys(Moments).map((momentType) =>
                    <Checkbox
                        key={momentType}
                        checked={widgetStore.moments.get(momentType as Moments)}
                        label={Moments[momentType]}
                        onChange={() => widgetStore.moments.set(momentType as Moments, !widgetStore.moments.get(momentType as Moments))}
                        disabled={!appStore.activeFrame}
                    />
                )}
                <div className="moment-generate">
                    <Button intent="success" onClick={this.handleMomentGenerate} disabled={!appStore.activeFrame}>Generate</Button>
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
