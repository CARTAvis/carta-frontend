import * as React from "react";
import {observer} from "mobx-react";
import {Button, Checkbox, Divider, FormGroup, HTMLSelect, MenuItem, NumericInput, Position, Tooltip} from "@blueprintjs/core";
import {ItemRenderer, MultiSelect} from "@blueprintjs/select";
import {RegionSelectorComponent} from "components";
import {SafeNumericInput, SpectralSettingsComponent} from "components/Shared";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {AppStore} from "stores";
import {MomentMask, Moments} from "models";
import "./MomentGeneratorComponent.css";

const MomentMultiSelect = MultiSelect.ofType<Moments>();

@observer
export class MomentGeneratorComponent extends React.Component<{widgetStore: SpectralProfileWidgetStore}> {
    private onChannelFromChanged = (from: number) => {
        const frame = AppStore.Instance.activeFrame;
        const widgetStore = this.props.widgetStore;
        if (frame && isFinite(from) && from >= 0 && from < frame.numChannels) {
            widgetStore.setChannelRange([from, widgetStore.channelRange[1]]);
        }
    };

    private onChannelToChanged = (to: number) => {
        const frame = AppStore.Instance.activeFrame;
        const widgetStore = this.props.widgetStore;
        if (frame && isFinite(to) && to >= 0 && to < frame.numChannels) {
            widgetStore.setChannelRange([widgetStore.channelRange[0], to]);
        }
    };

    private renderMomentTag = (momentType: Moments) => `${momentType}`;
    private renderMomentSelectItem:  ItemRenderer<Moments>  = (momentType: Moments, {modifiers, handleClick}) => {
        return <MenuItem text={`${Moments[momentType]}`} onClick={handleClick} key={momentType}/>;
    };

    private handleMomentsClear = () => {
        const widgetStore = this.props.widgetStore;
        Object.keys(Moments).map((momentType) => {});
    };

    private handleMomentTagRemove = () => {
        const widgetStore = this.props.widgetStore;
        Object.keys(Moments).map((momentType) => {});
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

        const dataSourcePanel = (null);
        const regionPanel = <RegionSelectorComponent widgetStore={this.props.widgetStore}/>;

        const spectralPanel = (
            <React.Fragment>
                <SpectralSettingsComponent widgetStore={this.props.widgetStore} disable={false}/>
                {activeFrame && activeFrame.numChannels > 1 &&
                    <React.Fragment>
                        <FormGroup label="Range"/>
                        <div className="range-select">
                            <FormGroup label="From" inline={true}>
                                <SafeNumericInput
                                    value={widgetStore.channelRange[0]}
                                    min={0}
                                    max={activeFrame.numChannels - 1}
                                    step={1}
                                    onValueChange={val => this.onChannelFromChanged(val)}
                                />
                            </FormGroup>
                            <FormGroup label="To" inline={true}>
                                <SafeNumericInput
                                    value={widgetStore.channelRange[1]}
                                    min={widgetStore.channelRange[0]}
                                    max={activeFrame.numChannels - 1}
                                    step={1}
                                    onValueChange={val => this.onChannelToChanged(val)}
                                />
                            </FormGroup>
                            <div className="cursor-select">
                                <Tooltip content="Use cursor to select range in profiler" position={Position.BOTTOM}>
                                    <Button
                                        className={widgetStore.isCursorSelect ? "bp3-active" : ""}
                                        icon="select"
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

        const clearButton = <Button icon="cross" minimal={true} onClick={this.handleMomentsClear}/>;

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

                <MomentMultiSelect
                    items={Object.keys(Moments) as Moments[]}
                    itemRenderer={this.renderMomentSelectItem}
                    onItemSelect={(momentType) => widgetStore.setSelectedMoment(momentType)}
                    fill={true}
                    popoverProps={{minimal: true, position: "bottom"}}
                    tagRenderer={this.renderMomentTag}
                    tagInputProps={{
                        onRemove: this.handleMomentTagRemove,
                        rightElement: clearButton
                    }}
                />
            </React.Fragment>
        );

        return (
            <div className="moment-generator">
                <div className="panel-left">
                    {dataSourcePanel}
                    <Divider/>
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
