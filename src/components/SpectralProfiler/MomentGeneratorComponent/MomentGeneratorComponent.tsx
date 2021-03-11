import * as React from "react";
import {observer} from "mobx-react";
import {CARTA} from "carta-protobuf";
import {AnchorButton, Button, Divider, FormGroup, HTMLSelect, MenuItem, Position, Tooltip} from "@blueprintjs/core";
import {ItemPredicate, ItemRenderer, MultiSelect} from "@blueprintjs/select";
import {RegionSelectorComponent} from "components";
import {TaskProgressDialogComponent} from "components/Dialogs";
import {SafeNumericInput, SpectralSettingsComponent} from "components/Shared";
import {MomentSelectingMode, SpectralProfileWidgetStore, RegionId} from "stores/widgets";
import {AppStore} from "stores";
import {MOMENT_TEXT} from "models";
import "./MomentGeneratorComponent.scss";

const MomentMultiSelect = MultiSelect.ofType<CARTA.Moment>();

@observer
export class MomentGeneratorComponent extends React.Component<{widgetStore: SpectralProfileWidgetStore}> {
    private onChannelFromChanged = (from: number) => {
        const widgetStore = this.props.widgetStore;
        const frame = widgetStore.effectiveFrame;
        if (frame && isFinite(from)) {
            widgetStore.setSelectedChannelRange(from, widgetStore.channelValueRange[1]);
        }
    };

    private onChannelToChanged = (to: number) => {
        const widgetStore = this.props.widgetStore;
        const frame = widgetStore.effectiveFrame;
        if (frame && isFinite(to)) {
            widgetStore.setSelectedChannelRange(widgetStore.channelValueRange[0], to);
        }
    };

    private handleChannelSelectionClicked = () => {
        const widgetStore = this.props.widgetStore;
        widgetStore.setMomentRangeSelectingMode(widgetStore.isSelectingMomentChannelRange ?  MomentSelectingMode.NONE : MomentSelectingMode.CHANNEL);
    };

    private onMaskFromChanged = (from: number) => {
        const widgetStore = this.props.widgetStore;
        const frame = widgetStore.effectiveFrame;
        if (frame && isFinite(from)) {
            widgetStore.setSelectedMaskRange(from, widgetStore.maskRange[1]);
        }
    };

    private onMaskToChanged = (to: number) => {
        const widgetStore = this.props.widgetStore;
        const frame = widgetStore.effectiveFrame;
        if (frame && isFinite(to)) {
            widgetStore.setSelectedMaskRange(widgetStore.maskRange[0], to);
        }
    };

    private handleMaskSelectionClicked = () => {
        const widgetStore = this.props.widgetStore;
        widgetStore.setMomentRangeSelectingMode(widgetStore.isSelectingMomentMaskRange ? MomentSelectingMode.NONE : MomentSelectingMode.MASK);
    };

    private filterMoment: ItemPredicate<CARTA.Moment> = (query, moment, index, exactMatch) => {
        const momentContent = MOMENT_TEXT.get(moment);
        const normalizedMoment = momentContent.tag.toLowerCase();
        const normalizedQuery = query.toLowerCase();

        if (exactMatch) {
            return normalizedMoment === normalizedQuery;
        } else {
            return momentContent.tag.indexOf(normalizedQuery) >= 0;
        }
    };

    private renderMomentTag = (moment: CARTA.Moment) => {
        const momentContent = MOMENT_TEXT.get(moment);
        return momentContent ? momentContent.tag : undefined;
    };

    private renderMomentSelectItem:  ItemRenderer<CARTA.Moment>  = (moment: CARTA.Moment, {modifiers, handleClick}) => {
        const momentContent = MOMENT_TEXT.get(moment);
        return momentContent ? <MenuItem text={`${momentContent.tag}: ${momentContent.text}`} onClick={handleClick} key={moment} icon={this.props.widgetStore.isMomentSelected(moment) ? "tick" : "blank"}/> : undefined;
    };

    private handleMomentTagRemove = (tag: string, index: number) => {
        this.props.widgetStore.removeMomentByIndex(index);
    };

    private handleMomentsClear = () => {
        this.props.widgetStore.clearSelectedMoments();
    };

    private handleRequestMoment = () => {
        this.props.widgetStore.requestMoment();
    };

    private handleRequestingMomentCancelled = () => {
        this.props.widgetStore.requestingMomentCancelled();
    };

    render() {
        const appStore = AppStore.Instance;
        const widgetStore = this.props.widgetStore;
        const frame = widgetStore.effectiveFrame;

        const regionPanel = <RegionSelectorComponent widgetStore={this.props.widgetStore} nonClosedDisabled={true}/>;

        const spectralPanel = (
            <React.Fragment>
                <SpectralSettingsComponent
                    frame={frame}
                    onSpectralCoordinateChange={widgetStore.setSpectralCoordinate}
                    onSpectralSystemChange={widgetStore.setSpectralSystem}
                    disable={frame?.isPVImage}
                />
                {frame && frame.numChannels > 1 &&
                    <FormGroup label="Range" inline={true} labelInfo={frame?.spectralUnit ? `(${frame.spectralUnit})` : ""}>
                        <div className="range-select">
                            <FormGroup label="From" inline={true}>
                                <SafeNumericInput
                                    value={widgetStore.channelValueRange[0]}
                                    buttonPosition="none"
                                    onValueChange={val => this.onChannelFromChanged(val)}
                                />
                            </FormGroup>
                            <FormGroup label="To" inline={true}>
                                <SafeNumericInput
                                    value={widgetStore.channelValueRange[1]}
                                    buttonPosition="none"
                                    onValueChange={val => this.onChannelToChanged(val)}
                                />
                            </FormGroup>
                            <div className="cursor-select">
                                <Tooltip content="Use cursor to select channel range in profiler" position={Position.BOTTOM}>
                                    <AnchorButton
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
                <FormGroup label="Mask" inline={true} disabled={!frame}>
                    <HTMLSelect
                        value={widgetStore.momentMask}
                        options={Object.keys(CARTA.MomentMask).map((key) => ({label: key, value: CARTA.MomentMask[key]}))}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => widgetStore.setMomentMask(parseInt(event.currentTarget.value) as CARTA.MomentMask)}
                        disabled={!frame}
                    />
                </FormGroup>
                {frame && frame.numChannels > 1 &&
                    <FormGroup label="Range"  inline={true} labelInfo={`(${frame.unit})`}>
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
                                    <AnchorButton
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

        const effectiveRegion = (frame?.regionSet?.regions) ? frame.regionSet.regions.find(r => r.regionId === widgetStore.effectiveRegionId) : null;
        const isEnabledRegion = effectiveRegion && effectiveRegion.isClosedRegion;
        const isImage = widgetStore.regionIdMap.get(widgetStore.fileId) !== RegionId.CURSOR && widgetStore.effectiveRegionId === 0; // request image when region dropdown is active with no region selected
        const isAbleToGenerate = frame && frame.numChannels > 1 && !appStore.animatorStore.animationActive && !appStore.widgetsStore.isSpectralWidgetStreamingData && (isEnabledRegion || isImage);
        const hint = <span><br/><i><small>Please ensure<br/>1. Animation playback is stopped.<br/>2. Spectral profile generation is complete.<br/>3. Cursor or point region is not selected.</small></i></span>;
        const msg = <span>Unable to generate moment images{hint}</span>;
        const momentsPanel = (
            <React.Fragment>
                <FormGroup label="Moments" inline={true}>
                    <MomentMultiSelect
                        placeholder="Select..."
                        items={Object.values(CARTA.Moment) as CARTA.Moment[]}
                        itemPredicate={this.filterMoment}
                        itemRenderer={this.renderMomentSelectItem}
                        onItemSelect={(moment) => widgetStore.isMomentSelected(moment) ? widgetStore.deselectMoment(moment) : widgetStore.selectMoment(moment)}
                        selectedItems={widgetStore.selectedMoments}
                        resetOnSelect={true}
                        fill={true}
                        popoverProps={{minimal: true, position: "bottom"}}
                        tagRenderer={this.renderMomentTag}
                        tagInputProps={{
                            onRemove: this.handleMomentTagRemove,
                            tagProps: {
                                minimal: true,
                            },
                            rightElement: <Button icon="cross" minimal={true} onClick={this.handleMomentsClear}/>
                        }}
                    />
                </FormGroup>
                <div className="moment-generate">
                    <Tooltip disabled={isAbleToGenerate} content={msg} position={Position.BOTTOM}>
                        <AnchorButton
                            intent="success"
                            onClick={this.handleRequestMoment}
                            disabled={!isAbleToGenerate}
                        >
                            Generate
                        </AnchorButton>
                    </Tooltip>
                </div>
            </React.Fragment>
        );

        return (
            <div className="moment-generator">
                <div className="moment-panel">
                    {regionPanel}
                    <Divider/>
                    {spectralPanel}
                    <Divider/>
                    {maskPanel}
                    <Divider/>
                    {momentsPanel}
                </div>
                <TaskProgressDialogComponent
                    isOpen={frame && frame.isRequestingMoments && frame.requestingMomentsProgress < 1}
                    progress={frame ? frame.requestingMomentsProgress : 0}
                    timeRemaining={appStore.estimatedTaskRemainingTime}
                    cancellable={true}
                    onCancel={this.handleRequestingMomentCancelled}
                    text={"Generating moments"}
                />
            </div>
        );
    }
}
