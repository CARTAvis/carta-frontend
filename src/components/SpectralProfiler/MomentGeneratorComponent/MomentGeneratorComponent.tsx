import * as React from "react";
import {observer} from "mobx-react";
import {Button, Divider, FormGroup, HTMLSelect, MenuItem, Position, Tooltip} from "@blueprintjs/core";
import {ItemRenderer, MultiSelect, Select} from "@blueprintjs/select";
import {RegionSelectorComponent} from "components";
import {SafeNumericInput, SpectralSettingsComponent} from "components/Shared";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {AppStore, FrameStore} from "stores";
import {MomentMask, Moments} from "models";
import "./MomentGeneratorComponent.css";

const DataSourceSelect = Select.ofType<FrameStore>();
const MomentMultiSelect = MultiSelect.ofType<Moments>();

@observer
export class MomentGeneratorComponent extends React.Component<{widgetStore: SpectralProfileWidgetStore}> {
    private renderDataSourceSelectItem = (frame: FrameStore, {handleClick, modifiers, query}) => {
        if (!frame) {
            return null;
        }
        return <MenuItem text={frame.frameInfo.fileInfo.name} onClick={handleClick} key={frame.frameInfo.fileId}/>;
    };

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

    private handleChannelSelectionClicked = () => {
        const widgetStore = this.props.widgetStore;
        widgetStore.setChannelCursorSelect(!widgetStore.isChannelCursorSelect);
        widgetStore.setMaskCursorSelect(false);
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

    private handleMaskSelectionClicked = () => {
        const widgetStore = this.props.widgetStore;
        widgetStore.setMaskCursorSelect(!widgetStore.isMaskCursorSelect);
        widgetStore.setChannelCursorSelect(false);
    };

    private renderMomentTag = (momentType: Moments) => `${ momentType ? (Moments[momentType].split(":"))[0] : ""}`;
    private renderMomentSelectItem:  ItemRenderer<Moments>  = (momentType: Moments, {modifiers, handleClick}) => {
        return <MenuItem text={`${Moments[momentType]}`} onClick={handleClick} key={momentType} icon={this.props.widgetStore.isMomentSelected(momentType) ? "tick" : "blank"}/>;
    };

    private handleMomentTagRemove = (tag: string, index: number) => {
        this.props.widgetStore.removeMomentByIndex(index);
    };

    private handleMomentsClear = () => {
        this.props.widgetStore.clearSelectedMoments();
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

        const dataSourcePanel = (
            <FormGroup inline={true} label="Data Source">
                <DataSourceSelect
                    activeItem={activeFrame}
                    onItemSelect={appStore.setContourDataSource}
                    popoverProps={{minimal: true, position: "bottom"}}
                    filterable={false}
                    items={appStore.frames}
                    itemRenderer={this.renderDataSourceSelectItem}
                >
                    <Button text={activeFrame.frameInfo.fileInfo.name} rightIcon="double-caret-vertical" alignText={"right"}/>
                </DataSourceSelect>
                <Tooltip content={appStore.frameLockedToContour ? "Data source is locked to active image" : "Data source is independent of active image"}>
                    <Button className="lock-button" icon={appStore.frameLockedToContour ? "lock" : "unlock"} minimal={true} onClick={appStore.toggleFrameContourLock}/>
                </Tooltip>
            </FormGroup>
        );
        const regionPanel = <RegionSelectorComponent widgetStore={this.props.widgetStore}/>;

        const spectralPanel = (
            <React.Fragment>
                <SpectralSettingsComponent widgetStore={this.props.widgetStore} disable={false}/>
                {activeFrame && activeFrame.numChannels > 1 &&
                    <FormGroup label="Range"  inline={true}>
                        <div className="range-select">
                            <FormGroup label="From" inline={true}>
                                <SafeNumericInput
                                    value={widgetStore.channelRange[0]}
                                    buttonPosition="none"
                                    onValueChange={val => this.onChannelFromChanged(val)}
                                />
                            </FormGroup>
                            <FormGroup label="To" inline={true}>
                                <SafeNumericInput
                                    value={widgetStore.channelRange[1]}
                                    buttonPosition="none"
                                    onValueChange={val => this.onChannelToChanged(val)}
                                />
                            </FormGroup>
                            <div className="cursor-select">
                                <Tooltip content="Use cursor to select channel range in profiler" position={Position.BOTTOM}>
                                    <Button
                                        className={widgetStore.isChannelCursorSelect ? "bp3-active" : ""}
                                        icon="select"
                                        onClick={this.handleChannelSelectionClicked}
                                    />
                                </Tooltip>
                            </div>
                        </div>
                    </FormGroup>
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
                {activeFrame && activeFrame.numChannels > 1 &&
                    <FormGroup label="Range"  inline={true}>
                        <div className="range-select">
                            <FormGroup label="From" inline={true}>
                                <SafeNumericInput
                                    value={widgetStore.maskRange[0]}
                                    buttonPosition="none"
                                    onValueChange={val => this.onMaskFromChanged(val)}
                                />
                            </FormGroup>
                            <FormGroup label="To" inline={true}>
                                <SafeNumericInput
                                    value={widgetStore.maskRange[1]}
                                    buttonPosition="none"
                                    onValueChange={val => this.onMaskToChanged(val)}
                                />
                            </FormGroup>
                            <div className="cursor-select">
                                <Tooltip content="Use cursor to select mask range in profiler" position={Position.BOTTOM}>
                                    <Button
                                        className={widgetStore.isMaskCursorSelect ? "bp3-active" : ""}
                                        icon="select"
                                        onClick={this.handleMaskSelectionClicked}
                                    />
                                </Tooltip>
                            </div>
                        </div>
                    </FormGroup>
                }
            </React.Fragment>
        );

        const momentsPanel = (
            <React.Fragment>
                <FormGroup label="Moments" inline={true}>
                    <MomentMultiSelect
                        placeholder="Select..."
                        items={Object.keys(Moments) as Moments[]}
                        itemRenderer={this.renderMomentSelectItem}
                        onItemSelect={(momentType) => widgetStore.isMomentSelected(momentType) ? widgetStore.deselectMoment(momentType) : widgetStore.selectMoment(momentType)}
                        selectedItems={widgetStore.selectedMoments}
                        fill={true}
                        popoverProps={{minimal: true, position: "bottom"}}
                        tagRenderer={this.renderMomentTag}
                        tagInputProps={{
                            onRemove: this.handleMomentTagRemove,
                            rightElement: <Button icon="cross" minimal={true} onClick={this.handleMomentsClear}/>
                        }}
                    />
                </FormGroup>
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
