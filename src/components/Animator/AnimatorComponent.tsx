import * as React from "react";
import {AnchorButton, Button, ButtonGroup, Classes, ControlGroup, HTMLSelect, type IconName, Menu, MenuItem, NonIdealState, type NumberRange, Popover, Position, Pre, Radio, RangeSlider, Slider, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {ResizeDetector, SafeNumericInput, ScrollShadow} from "components/Shared";
import {AnimationMode, HelpType, PlayMode} from "enums";
import {AnimatorStore, AppStore, type DefaultWidgetConfig, type WidgetProps} from "stores";

import "./AnimatorComponent.scss";

enum NumericInputType {
    FrameRate = "Frame rate",
    Step = "Step"
}

@observer
export class AnimatorComponent extends React.Component<WidgetProps> {
    public static get WidgetConfig(): DefaultWidgetConfig {
        return {
            id: "animator",
            type: "animator",
            minWidth: 250,
            minHeight: 200,
            defaultWidth: 650,
            defaultHeight: 200,
            title: "Animator",
            isCloseable: true,
            helpType: HelpType.ANIMATOR
        };
    }

    @observable width: number = 650;
    @observable height: number = 200;
    @observable numericInputType: NumericInputType = NumericInputType.FrameRate;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @action onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    @action onNumericInputTypeChange = (type: NumericInputType) => {
        this.numericInputType = type;
    };

    onChannelChanged = (val: number) => {
        const frame = AppStore.Instance.activeFrame;
        if (frame) {
            const depth = frame.frameInfo.fileInfoExtended.depth;
            if (val < 0) {
                val += depth;
            }
            if (val >= depth) {
                val = 0;
            }
            frame.setChannel(val);
        }
    };

    onRangeChanged = (range: NumberRange) => {
        const frame = AppStore.Instance.activeFrame;
        if (range && range.length === 2 && frame) {
            const depth = frame.frameInfo.fileInfoExtended.depth;
            if (range[0] >= 0 && range[0] < range[1] && range[1] < depth) {
                frame.setAnimationRange(range);
            }
        }
    };

    onStokesChanged = (val: number) => {
        const frame = AppStore.Instance.activeFrame;
        frame?.setStokesByIndex(val, true);
    };

    onImageChanged = (val: number) => {
        const appStore = AppStore.Instance;
        const imageNum = appStore.imageViewConfigStore.imageNum;
        if (val < 0) {
            val += imageNum;
        }
        if (val >= imageNum) {
            val = 0;
        }
        appStore.setActiveImageByIndex(val);
    };

    onAnimationModeChanged = (event: React.FormEvent<HTMLInputElement>) => {
        const newMode = parseInt(event.currentTarget.value) as AnimationMode;
        AnimatorStore.Instance.setAnimationMode(newMode);
    };

    onFirstClicked = () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;

        if (!frame) {
            return;
        }

        switch (appStore.animatorStore.animationMode) {
            case AnimationMode.FRAME:
                appStore.setActiveImageByIndex(0);
                break;
            case AnimationMode.CHANNEL:
                frame.setChannels(0, frame.stokes, true);
                break;
            case AnimationMode.STOKES:
                frame.setChannels(frame.channel, 0, true);
                break;
            default:
                break;
        }
    };

    onLastClicked = () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;

        if (!frame) {
            return;
        }

        switch (appStore.animatorStore.animationMode) {
            case AnimationMode.FRAME:
                appStore.setActiveImageByIndex(appStore.imageViewConfigStore.imageNum - 1);
                break;
            case AnimationMode.CHANNEL:
                const depth = frame.frameInfo.fileInfoExtended.depth;
                frame.setChannels(depth - 1, frame.stokes, true);
                break;
            case AnimationMode.STOKES:
                const stokes = frame.frameInfo.fileInfoExtended.stokes;
                frame.setChannels(frame.channel, stokes < frame.polarizations.length ? frame.polarizations[frame.polarizations.length - 1] : stokes - 1, true);
                break;
            default:
                break;
        }
    };

    onNextClicked = () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;

        if (!frame) {
            return;
        }

        switch (appStore.animatorStore.animationMode) {
            case AnimationMode.FRAME:
                appStore.nextImage();
                break;
            case AnimationMode.CHANNEL:
                frame.incrementChannels(1, 0);
                break;
            case AnimationMode.STOKES:
                frame.incrementChannels(0, 1);
                break;
            default:
                break;
        }
    };

    onPrevClicked = () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;

        if (!frame) {
            return;
        }

        switch (appStore.animatorStore.animationMode) {
            case AnimationMode.FRAME:
                appStore.prevImage();
                break;
            case AnimationMode.CHANNEL:
                frame.incrementChannels(-1, 0);
                break;
            case AnimationMode.STOKES:
                frame.incrementChannels(0, -1);
                break;
            default:
                break;
        }
    };

    private getPlayModeIcon = (): IconName => {
        switch (AnimatorStore.Instance.playMode) {
            case PlayMode.FORWARD:
            default:
                return "arrow-right";
            case PlayMode.BACKWARD:
                return "arrow-left";
            case PlayMode.BOUNCING:
                return "swap-horizontal";
            case PlayMode.BLINK:
                return "exchange";
        }
    };

    public render() {
        const appStore = AppStore.Instance;
        const numImages = appStore.imageViewConfigStore.imageNum;
        const activeFrame = appStore.activeFrame;
        const numChannels = activeFrame ? activeFrame.frameInfo.fileInfoExtended.depth : 0;
        const numStokes = activeFrame ? activeFrame.frameInfo.fileInfoExtended.stokes : 0;

        const isIconOnly = this.width < 625;
        const isHideSliders = this.width < 450;

        let channelSlider, channelRangeSlider, stokesSlider, imageSlider;
        // Image Control
        const imageIndex = appStore.activeImageIndex;
        if (numImages > 1 && imageIndex !== -1) {
            const numIndices = 5;
            const imageStep = numImages > 10 ? Math.floor((numImages - 1) / (numIndices - 1)) : 1;
            const imageTickPre = numImages - 1 - 4 * imageStep < imageStep / 2 ? [0, imageStep, 2 * imageStep, 3 * imageStep, numImages - 1] : [0, imageStep, 2 * imageStep, 3 * imageStep, 4 * imageStep, numImages - 1];
            const imageTick = numImages > 10 ? imageTickPre : Array.from(Array(numImages).keys());
            imageSlider = (
                <div className="animator-slider">
                    <Radio value={AnimationMode.FRAME} disabled={appStore.animatorStore.isAnimationActive} checked={appStore.animatorStore.animationMode === AnimationMode.FRAME} onChange={this.onAnimationModeChanged} label="Image" />
                    {isHideSliders && <SafeNumericInput value={imageIndex} min={-1} max={numImages} stepSize={1} onValueChange={this.onImageChanged} fill={true} disabled={appStore.animatorStore.isAnimationActive} />}
                    {!isHideSliders && appStore.activeImage?.store.filename && (
                        <React.Fragment>
                            <Slider value={imageIndex} min={0} max={numImages - 1} showTrackFill={false} labelValues={imageTick} labelPrecision={0} onChange={this.onImageChanged} disabled={appStore.animatorStore.isAnimationActive} />
                            <div className="slider-info">{appStore.activeImage.store.filename}</div>
                        </React.Fragment>
                    )}
                </div>
            );
        }

        // Channel Control
        if (numChannels > 1 && activeFrame) {
            const numLabels = 5;
            const channelStep = numChannels > 10 ? Math.floor((numChannels - 1) / (numLabels - 1)) : 1;
            const channelTickPre =
                numChannels - 1 - 4 * channelStep < channelStep / 2 ? [0, channelStep, 2 * channelStep, 3 * channelStep, numChannels - 1] : [0, channelStep, 2 * channelStep, 3 * channelStep, 4 * channelStep, numChannels - 1];
            const channelTick = numChannels > 10 ? channelTickPre : Array.from(Array(numChannels).keys());
            channelSlider = (
                <div className="animator-slider" data-testid="animator-slider">
                    <Radio
                        value={AnimationMode.CHANNEL}
                        disabled={appStore.animatorStore.isAnimationActive}
                        checked={appStore.animatorStore.animationMode === AnimationMode.CHANNEL}
                        onChange={this.onAnimationModeChanged}
                        label={activeFrame.channelType}
                    />
                    {isHideSliders && <SafeNumericInput value={activeFrame.requiredChannel} min={-1} max={numChannels} stepSize={1} onValueChange={this.onChannelChanged} fill={true} disabled={appStore.animatorStore.isAnimationActive} />}
                    {!isHideSliders && (
                        <React.Fragment>
                            <Slider
                                className="channel-slider"
                                value={activeFrame.requiredChannel}
                                min={0}
                                max={numChannels - 1}
                                labelValues={channelTick}
                                labelPrecision={0}
                                showTrackFill={false}
                                onChange={this.onChannelChanged}
                                disabled={appStore.animatorStore.isAnimationActive}
                            />
                            <div className="slider-info" data-testid="animator-slider-info">
                                <Pre>{activeFrame.depthAxisInfo}</Pre>
                            </div>
                        </React.Fragment>
                    )}
                </div>
            );
            channelRangeSlider = (
                <div className="animator-slider range-slider" data-testid="animator-range-slider">
                    <div className="range-label" />
                    {!isHideSliders && (
                        <React.Fragment>
                            <RangeSlider
                                value={activeFrame.animationChannelRange}
                                min={0}
                                max={numChannels - 1}
                                labelStepSize={channelStep}
                                labelPrecision={0}
                                onChange={this.onRangeChanged}
                                disabled={appStore.animatorStore.isAnimationActive}
                            />
                            <div className="slider-info" />
                        </React.Fragment>
                    )}
                </div>
            );
        }

        // Stokes Control
        if (numStokes > 1 && activeFrame) {
            stokesSlider = (
                <div className={classNames("animator-slider", "stokes-slider", {"tiled-label": this.width < 750})} data-testid="animator-polarization-slider">
                    <Radio
                        value={AnimationMode.STOKES}
                        disabled={appStore.animatorStore.isAnimationActive}
                        checked={appStore.animatorStore.animationMode === AnimationMode.STOKES}
                        onChange={this.onAnimationModeChanged}
                        label="Polarization"
                    />
                    {isHideSliders && (
                        <SafeNumericInput
                            value={activeFrame.requiredStokes}
                            min={-1}
                            max={activeFrame.frameInfo.fileInfoExtended.stokes}
                            stepSize={1}
                            onValueChange={this.onStokesChanged}
                            disabled={appStore.animatorStore.isAnimationActive}
                            fill={true}
                        />
                    )}
                    {!isHideSliders && (
                        <React.Fragment>
                            <Slider
                                value={activeFrame.requiredPolarizationIndex}
                                min={0}
                                showTrackFill={false}
                                max={activeFrame.polarizations.length - 1}
                                labelRenderer={(val: number) => {
                                    return isFinite(val) && val >= 0 && val < (activeFrame?.polarizationInfo?.length ?? 0) ? (activeFrame.polarizationInfo?.[val] ?? `${val}`) : `${val}`;
                                }}
                                onChange={this.onStokesChanged}
                                disabled={appStore.animatorStore.isAnimationActive}
                            />
                            <div className="slider-info" />
                        </React.Fragment>
                    )}
                </div>
            );
        }

        const playbackClass = classNames("animator-playback", {wrap: isHideSliders});
        const playbackModeClass = classNames("playback-mode", {[Classes.DARK]: appStore.isDarkTheme});

        const playbackModeButton = (
            <Popover
                className={playbackModeClass}
                content={
                    <Menu>
                        <MenuItem icon="arrow-right" text="Play forward" active={appStore.animatorStore.playMode === PlayMode.FORWARD} onClick={() => (appStore.animatorStore.playMode = PlayMode.FORWARD)} />
                        <MenuItem icon="arrow-left" text="Play backwards" active={appStore.animatorStore.playMode === PlayMode.BACKWARD} onClick={() => (appStore.animatorStore.playMode = PlayMode.BACKWARD)} />
                        <MenuItem icon="swap-horizontal" text="Bouncing" active={appStore.animatorStore.playMode === PlayMode.BOUNCING} onClick={() => (appStore.animatorStore.playMode = PlayMode.BOUNCING)} />
                        <MenuItem icon="exchange" text="Blink" active={appStore.animatorStore.playMode === PlayMode.BLINK} onClick={() => (appStore.animatorStore.playMode = PlayMode.BLINK)} />
                    </Menu>
                }
                position={Position.TOP}
                disabled={appStore.channelMapStore.isChannelMapEnabled}
            >
                <Tooltip content="Playback mode" position={Position.TOP}>
                    <AnchorButton icon={this.getPlayModeIcon()} disabled={appStore.animatorStore.isAnimationActive || appStore.channelMapStore.isChannelMapEnabled} data-testid="animator-playback-mode-button">
                        {!isIconOnly && "Mode"}
                    </AnchorButton>
                </Tooltip>
            </Popover>
        );

        const playbackButtons = (
            <ButtonGroup fill={true} className="playback-buttons">
                <Button icon={"chevron-backward"} onClick={this.onFirstClicked} data-testid="animator-first-button">
                    {!isIconOnly && "First"}
                </Button>
                <Button icon={"step-backward"} onClick={this.onPrevClicked} data-testid="animator-previous-button">
                    {!isIconOnly && "Prev"}
                </Button>
                {appStore.animatorStore.isAnimationActive && (
                    <Button icon={"stop"} onClick={appStore.animatorStore.stopAnimation} disabled={appStore.channelMapStore.isChannelMapEnabled} data-testid="animator-play-stop-button">
                        {!isIconOnly && "Stop"}
                    </Button>
                )}
                {!appStore.animatorStore.isAnimationActive && (
                    <Button icon={"play"} onClick={appStore.animatorStore.startAnimation} disabled={appStore.animatorStore.isStartAnimationDisabled || appStore.channelMapStore.isChannelMapEnabled} data-testid="animator-play-stop-button">
                        {!isIconOnly && "Play"}
                    </Button>
                )}
                <Button icon={"step-forward"} onClick={this.onNextClicked} data-testid="animator-next-button">
                    {!isIconOnly && "Next"}
                </Button>
                <Button icon={"chevron-forward"} onClick={this.onLastClicked} data-testid="animator-last-button">
                    {!isIconOnly && "Last"}
                </Button>
            </ButtonGroup>
        );

        const numericControl = (
            <ControlGroup className="playback-numeric-control">
                <HTMLSelect
                    disabled={appStore.animatorStore.isAnimationActive || appStore.channelMapStore.isChannelMapEnabled}
                    options={[NumericInputType.FrameRate, NumericInputType.Step]}
                    onChange={ev => this.onNumericInputTypeChange(ev.currentTarget.value as NumericInputType)}
                />
                {this.numericInputType === NumericInputType.FrameRate ? (
                    <SafeNumericInput
                        value={appStore.animatorStore.frameRate}
                        min={appStore.animatorStore.minFrameRate}
                        max={appStore.animatorStore.maxFrameRate}
                        stepSize={1}
                        minorStepSize={1}
                        majorStepSize={1}
                        onValueChange={appStore.animatorStore.setFrameRate}
                        disabled={appStore.animatorStore.isAnimationActive || appStore.channelMapStore.isChannelMapEnabled}
                        data-testid="animator-control-input"
                    />
                ) : (
                    <SafeNumericInput
                        value={appStore.animatorStore.step}
                        min={appStore.animatorStore.minStep}
                        max={appStore.animatorStore.maxStep}
                        stepSize={1}
                        minorStepSize={1}
                        majorStepSize={1}
                        onValueChange={appStore.animatorStore.setStep}
                        disabled={appStore.animatorStore.isAnimationActive || appStore.channelMapStore.isChannelMapEnabled}
                        data-testid="animator-control-input"
                    />
                )}
            </ControlGroup>
        );

        return (
            <ResizeDetector onResize={this.onResize} throttleTime={33}>
                <div className="animator-widget">
                    <ScrollShadow>
                        {!activeFrame && <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />}
                        {activeFrame && (
                            <div className={playbackClass}>
                                {playbackButtons}
                                {playbackModeButton}
                                {numericControl}
                            </div>
                        )}
                        {activeFrame &&
                            this.width > 0 && ( // temporary fix for broken range slider, issue #1078
                                <div className="animator-sliders">
                                    {imageSlider}
                                    {channelSlider}
                                    {channelRangeSlider}
                                    {stokesSlider}
                                </div>
                            )}
                    </ScrollShadow>
                </div>
            </ResizeDetector>
        );
    }
}
