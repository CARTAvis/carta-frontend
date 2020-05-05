import * as React from "react";
import {action, observable} from "mobx";
import {observer} from "mobx-react";
import {Alert, Button, Divider, FormGroup, HTMLSelect, MenuItem, Position, Tooltip} from "@blueprintjs/core";
import {ItemRenderer, MultiSelect} from "@blueprintjs/select";
import {RegionSelectorComponent} from "components";
import {TaskProgressDialogComponent} from "components/Dialogs";
import {SafeNumericInput, SpectralSettingsComponent} from "components/Shared";
import {MomentSelectingMode, SpectralProfileWidgetStore} from "stores/widgets";
import {AppStore} from "stores";
import {MomentMask, Moments} from "models";
import "./MomentGeneratorComponent.css";

const MomentMultiSelect = MultiSelect.ofType<Moments>();

@observer
export class MomentGeneratorComponent extends React.Component<{widgetStore: SpectralProfileWidgetStore}> {
    @observable showMomentAlert: boolean;

    @action handleMomentAlertConfirm = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            const widgetStore = this.props.widgetStore;
            widgetStore.setIsGeneratingMoments(true);
            appStore.generateMoment(appStore.activeFrame.frameInfo.fileId);
        }
        this.showMomentAlert = false;
    };

    @action handleMomentAlertCancel = () => {
        this.showMomentAlert = false;
    };

    private handleSelectedDataSource = (selectedFileId: number) => {
        return;
    };

    private onChannelFromChanged = (from: number) => {
        const frame = AppStore.Instance.activeFrame;
        const widgetStore = this.props.widgetStore;
        if (frame && isFinite(from)) {
            widgetStore.setSelectedChannelRange([from, widgetStore.channelRange[1]]);
        }
    };

    private onChannelToChanged = (to: number) => {
        const frame = AppStore.Instance.activeFrame;
        const widgetStore = this.props.widgetStore;
        if (frame && isFinite(to)) {
            widgetStore.setSelectedChannelRange([widgetStore.channelRange[0], to]);
        }
    };

    private handleChannelSelectionClicked = () => {
        const widgetStore = this.props.widgetStore;
        widgetStore.setMomentRangeSelectingMode(widgetStore.isSelectingMomentChannelRange ?  MomentSelectingMode.NONE : MomentSelectingMode.CHANNEL);
    };

    private onMaskFromChanged = (from: number) => {
        const frame = AppStore.Instance.activeFrame;
        const widgetStore = this.props.widgetStore;
        if (frame && isFinite(from)) {
            widgetStore.setSelectedMaskRange([from, widgetStore.maskRange[1]]);
        }
    };

    private onMaskToChanged = (to: number) => {
        const frame = AppStore.Instance.activeFrame;
        const widgetStore = this.props.widgetStore;
        if (frame && isFinite(to)) {
            widgetStore.setSelectedMaskRange([widgetStore.maskRange[0], to]);
        }
    };

    private handleMaskSelectionClicked = () => {
        const widgetStore = this.props.widgetStore;
        widgetStore.setMomentRangeSelectingMode(widgetStore.isSelectingMomentMaskRange ?  MomentSelectingMode.NONE : MomentSelectingMode.MASK);
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
        this.showMomentAlert = true;
    };

    private handleMomentGenerateCancelled = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            appStore.cancelMomentRequest(appStore.activeFrame.frameInfo.fileId);
        }
        this.props.widgetStore.setIsGeneratingMoments(false);
    };

    render() {
        const appStore = AppStore.Instance;
        const activeFrame = appStore.activeFrame;
        const widgetStore = this.props.widgetStore;

        const dataSourcePanel = (
            <FormGroup inline={true} label="Data Source" disabled={true}>
                <HTMLSelect
                    options={appStore.frameNames}
                    value={activeFrame ? activeFrame.frameInfo.fileId : ""}
                    onChange={(event: React.FormEvent<HTMLSelectElement>) => { this.handleSelectedDataSource(parseInt(event.currentTarget.value)); }}
                    disabled={true}
                />
            </FormGroup>
        );
        const regionPanel = <RegionSelectorComponent widgetStore={this.props.widgetStore}/>;

        const spectralPanel = (
            <React.Fragment>
                <SpectralSettingsComponent widgetStore={this.props.widgetStore} disable={false}/>
                {activeFrame && activeFrame.numChannels > 1 &&
                    <FormGroup label="Range"  inline={true} labelInfo={`(${activeFrame.spectralUnit})`}>
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
                                        className={widgetStore.isSelectingMomentChannelRange ? "bp3-active" : ""}
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
                    <FormGroup label="Range"  inline={true} labelInfo={`(${activeFrame.unit})`}>
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
                                        className={widgetStore.isSelectingMomentMaskRange ? "bp3-active" : ""}
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
                <Alert icon={"time"} isOpen={this.showMomentAlert} onCancel={this.handleMomentAlertCancel} onConfirm={this.handleMomentAlertConfirm} cancelButtonText={"Cancel"}>
                    <p>
                        Generating moments may take a long time, are you sure you want to continue?
                    </p>
                </Alert>
                <TaskProgressDialogComponent
                    isOpen={widgetStore.isGeneratingMoments}
                    progress={widgetStore.generatingMomentsProgress}
                    timeRemaining={appStore.estimatedTaskRemainingTime}
                    cancellable={true}
                    onCancel={this.handleMomentGenerateCancelled}
                    text={"Generating moments"}
                />
            </div>
        );
    }
}
