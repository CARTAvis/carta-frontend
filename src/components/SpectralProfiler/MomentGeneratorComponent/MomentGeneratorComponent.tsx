import * as React from "react";
import {observer} from "mobx-react";
import {Button, Checkbox, Divider, FormGroup, HTMLSelect, Label, NumericInput, NumberRange, Position, RangeSlider, Tooltip} from "@blueprintjs/core";
import {RegionSelectorComponent} from "components";
import {SpectralSettingsComponent} from "components/Shared";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {AppStore} from "stores";
import {MomentMask, Moments} from "models";
import "./MomentGeneratorComponent.css";

@observer
export class MomentGeneratorComponent extends React.Component<{widgetStore: SpectralProfileWidgetStore}> {
    private onChannelRangeChanged = (range: NumberRange) => {
        const frame = AppStore.Instance.activeFrame;
        const widgetStore = this.props.widgetStore;
        if (frame && range && range.length === 2 && range[0] >= 0 && range[0] < range[1] && range[1] < frame.numChannels) {
            widgetStore.setChannelRange(range);
        }
    };

    private handleMomentGenerate = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            appStore.generateMoment(appStore.activeFrame.frameInfo.fileId);
        }
    };

    render() {
        const appStore = AppStore.Instance;
        const activeFrame = appStore.activeFrame;
        const widgetStore = this.props.widgetStore;
        const regionPanel = <RegionSelectorComponent widgetStore={this.props.widgetStore}/>;

        const spectralPanel = (
            <React.Fragment>
                <SpectralSettingsComponent widgetStore={this.props.widgetStore} disable={false}/>
                {activeFrame && activeFrame.numChannels > 1 &&
                    <React.Fragment>
                        <Label>Channel</Label>
                        <div className="range-select">
                            <div className="range-slider">
                                <RangeSlider
                                    value={widgetStore.channelRange}
                                    min={0}
                                    max={activeFrame.numChannels - 1}
                                    labelStepSize={20}
                                    labelPrecision={0}
                                    onChange={this.onChannelRangeChanged}
                                />
                            </div>
                            <div className="cursor-select">
                                <Tooltip content="Use cursor to select range in profiler" position={Position.BOTTOM}>
                                    <Button
                                        className={widgetStore.isCursorSelect ? "bp3-active" : ""}
                                        icon="select"
                                        small={true}
                                        onClick={() => widgetStore.setCursorSelect(!widgetStore.isCursorSelect)}
                                    />
                                </Tooltip>
                            </div>
                        </div>
                    </React.Fragment>
                }
            </React.Fragment>
        );

        const maskPanel = (
            <React.Fragment>
                <FormGroup label="Mask" inline={true} disabled={!activeFrame}>
                    <HTMLSelect
                        value={widgetStore.momentMask}
                        options={Object.keys(MomentMask).map((key) => ({label: MomentMask[key], value: key}))}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => widgetStore.setMomentMask(event.currentTarget.value as MomentMask)}
                        disabled={!activeFrame}
                    />
                </FormGroup>
                <FormGroup label="From" inline={true} disabled={!activeFrame}>
                    <NumericInput
                        value={0}
                        selectAllOnFocus={true}
                        buttonPosition={"none"}
                        allowNumericCharactersOnly={true}
                        disabled={!activeFrame}
                    />
                </FormGroup>
                <FormGroup label="To" inline={true} disabled={!activeFrame}>
                    <NumericInput
                        value={0}
                        selectAllOnFocus={true}
                        buttonPosition={"none"}
                        allowNumericCharactersOnly={true}
                        disabled={!activeFrame}
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
                        disabled={!activeFrame}
                    />
                )}
                <div className="moment-generate">
                    <Button intent="success" onClick={this.handleMomentGenerate} disabled={!activeFrame}>Generate</Button>
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
