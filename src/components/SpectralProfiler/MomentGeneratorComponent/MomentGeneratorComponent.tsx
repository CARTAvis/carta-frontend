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

    private onMaskFromChanged = (from: number) => {
        const frame = AppStore.Instance.activeFrame;
        const widgetStore = this.props.widgetStore;
        if (frame && isFinite(from)) {
            widgetStore.setMaskRange([from, widgetStore.maskRange[1]]);
        }
    };

    private onMaskToChanged = (to: number) => {
        const frame = AppStore.Instance.activeFrame;
        const widgetStore = this.props.widgetStore;
        if (frame && isFinite(to)) {
            widgetStore.setMaskRange([widgetStore.maskRange[0], to]);
        }
    };

    private renderMomentTag = (momentType: Moments) => `${momentType}`;
    private renderMomentSelectItem:  ItemRenderer<Moments>  = (momentType: Moments, {modifiers, handleClick}) => {
        return <MenuItem text={`${Moments[momentType]}`} onClick={handleClick} key={momentType} icon={this.props.widgetStore.isMomentSelected(momentType) ? "tick" : "blank"}/>;
    };

    private handleMomentsClear = () => {
        const widgetStore = this.props.widgetStore;
        Object.keys(Moments).map((momentType) => widgetStore.setSelectedMoment(momentType as Moments, false));
    };

    private handleMomentTagRemove = (tag: string, index: number) => {
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
                                        className={widgetStore.isChannelCursorSelect ? "bp3-active" : ""}
                                        icon="select"
                                        onClick={() => widgetStore.setChannelCursorSelect(!widgetStore.isChannelCursorSelect)}
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
                <FormGroup label="Range"/>
                <div className="range-select">
                    <FormGroup label="From" inline={true}>
                        <SafeNumericInput
                            value={widgetStore.maskRange[0]}
                            min={0}
                            max={activeFrame.numChannels - 1}
                            step={1}
                            onValueChange={val => this.onMaskFromChanged(val)}
                        />
                    </FormGroup>
                    <FormGroup label="To" inline={true}>
                        <SafeNumericInput
                            value={widgetStore.maskRange[1]}
                            min={widgetStore.channelRange[0]}
                            max={activeFrame.numChannels - 1}
                            step={1}
                            onValueChange={val => this.onMaskToChanged(val)}
                        />
                    </FormGroup>
                    <div className="cursor-select">
                        <Tooltip content="Use cursor to select range in profiler" position={Position.BOTTOM}>
                            <Button
                                className={widgetStore.isMaskCursorSelect ? "bp3-active" : ""}
                                icon="select"
                                onClick={() => widgetStore.setMaskCursorSelect(!widgetStore.isMaskCursorSelect)}
                            />
                        </Tooltip>
                    </div>
                </div>
            </React.Fragment>
        );

        const momentsPanel = (
            <React.Fragment>
                <MomentMultiSelect
                    items={Object.keys(Moments) as Moments[]}
                    itemRenderer={this.renderMomentSelectItem}
                    onItemSelect={(momentType) => widgetStore.setSelectedMoment(momentType, true)}
                    fill={true}
                    popoverProps={{minimal: true, position: "bottom"}}
                    tagRenderer={this.renderMomentTag}
                    tagInputProps={{
                        onRemove: this.handleMomentTagRemove,
                        rightElement: <Button icon="cross" minimal={true} onClick={this.handleMomentsClear}/>
                    }}
                />
                <div className="moment-generate">
                    <Button intent="success" onClick={this.handleMomentGenerate} disabled={!activeFrame}>Generate</Button>
                </div>
            </React.Fragment>
        );

        return (
            <div className="moment-generator">
                <div className="moment-panel">
                    {dataSourcePanel}
                    <Divider/>
                    {regionPanel}
                    <Divider/>
                    {spectralPanel}
                    <Divider/>
                    {maskPanel}
                    <Divider/>
                    {momentsPanel}
                </div>
            </div>
        );
    }
}
