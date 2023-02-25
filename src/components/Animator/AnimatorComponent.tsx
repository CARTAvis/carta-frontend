import * as React from "react";
import ReactResizeDetector from "react-resize-detector";
import {AnchorButton, Button, ButtonGroup, ControlGroup, HTMLSelect, IconName, Menu, MenuItem, NonIdealState, NumberRange, Position, Radio, RangeSlider, Slider} from "@blueprintjs/core";
import {Popover2, Tooltip2} from "@blueprintjs/popover2";
import classNames from "classnames";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {SafeNumericInput} from "components/Shared";
import {AnimationMode, AnimatorStore, AppStore, DefaultWidgetConfig, HelpType, PlayMode, WidgetProps} from "stores";

import "./AnimatorComponent.scss";

enum NumericInputType {
    FrameRate = "Frame rate",
    Step = "Step"
}

@observer
export class AnimatorComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
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

    @observable width: number;
    @observable height: number;
    @observable numericInputType: NumericInputType;

    constructor(props: any) {
        super(props);
        makeObservable(this);
        this.numericInputType = NumericInputType.FrameRate;
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
            if (val < 0) {
                val += frame.frameInfo.fileInfoExtended.depth;
            }
            if (val >= frame.frameInfo.fileInfoExtended.depth) {
                val = 0;
            }
            frame.setChannels(val, frame.requiredStokes, true);
        }
    };

    onRangeChanged = (range: NumberRange) => {
        const frame = AppStore.Instance.activeFrame;
        if (range && range.length === 2 && frame) {
            if (range[0] >= 0 && range[0] < range[1] && range[1] < frame.frameInfo.fileInfoExtended.depth) {
                frame.setAnimationRange(range);
            }
        }
    };

    onStokesChanged = (val: number) => {
        const frame = AppStore.Instance.activeFrame;
        const isComputedPolarization = val >= frame.frameInfo.fileInfoExtended.stokes;
        // request standard polarization by the stokes index of image. (eg. "I": 0)
        // request computed polarization by PolarizationDefinition. (eg. "Pangle": 17)
        frame?.setChannels(frame.requiredChannel, isComputedPolarization ? frame.polarizations[val] : val, true);
    };

    onFrameChanged = (val: number) => {
        const appStore = AppStore.Instance;
        if (val < 0) {
            val += appStore.frames.length;
        }
        if (val >= appStore.frames.length) {
            val = 0;
        }
        appStore.setActiveFrameByIndex(val);
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
                appStore.setActiveFrameByIndex(0);
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
                appStore.setActiveFrameByIndex(appStore.frames.length - 1);
                break;
            case AnimationMode.CHANNEL:
                frame.setChannels(frame.frameInfo.fileInfoExtended.depth - 1, frame.stokes, true);
                break;
            case AnimationMode.STOKES:
                frame.setChannels(frame.channel, frame.frameInfo.fileInfoExtended.stokes < frame.polarizations.length ? frame.polarizations[frame.polarizations.length - 1] : frame.frameInfo.fileInfoExtended.stokes - 1, true);
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
                appStore.nextFrame();
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
                appStore.prevFrame();
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
        const numFrames = appStore.frames.length;
        const activeFrame = appStore.activeFrame;
        const numChannels = activeFrame ? activeFrame.frameInfo.fileInfoExtended.depth : 0;
        const numStokes = activeFrame ? activeFrame.frameInfo.fileInfoExtended.stokes : 0;

        const iconOnly = this.width < 625;
        const hideSliders = this.width < 450;

        let channelSlider, channelRangeSlider, stokesSlider, frameSlider;
        // Frame Control
        if (appStore.frames.length > 1) {
            const frameIndex = appStore.frames.findIndex(f => f.frameInfo.fileId === activeFrame.frameInfo.fileId);
            const numIndices = 5;
            const frameStep = numFrames > 10 ? Math.floor((numFrames - 1) / (numIndices - 1)) : 1;
            const frameTickPre = numFrames - 1 - 4 * frameStep < frameStep / 2 ? [0, frameStep, 2 * frameStep, 3 * frameStep, numFrames - 1] : [0, frameStep, 2 * frameStep, 3 * frameStep, 4 * frameStep, numFrames - 1];
            const frameTick = numFrames > 10 ? frameTickPre : Array.from(Array(numFrames).keys());
            frameSlider = (
                <div className="animator-slider">
                    <Radio value={AnimationMode.FRAME} disabled={appStore.animatorStore.animationActive} checked={appStore.animatorStore.animationMode === AnimationMode.FRAME} onChange={this.onAnimationModeChanged} label="Image" />
                    {hideSliders && <SafeNumericInput value={frameIndex} min={-1} max={numFrames} stepSize={1} onValueChange={this.onFrameChanged} fill={true} disabled={appStore.animatorStore.animationActive} />}
                    {!hideSliders && (
                        <React.Fragment>
                            <Slider value={frameIndex} min={0} max={numFrames - 1} showTrackFill={false} labelValues={frameTick} labelPrecision={0} onChange={this.onFrameChanged} disabled={appStore.animatorStore.animationActive} />
                            <div className="slider-info">{activeFrame.filename}</div>
                        </React.Fragment>
                    )}
                </div>
            );
        }

        // Channel Control
        if (numChannels > 1) {
            const numLabels = 5;
            const channelStep = numChannels > 10 ? Math.floor((numChannels - 1) / (numLabels - 1)) : 1;
            const channelTickPre =
                numChannels - 1 - 4 * channelStep < channelStep / 2 ? [0, channelStep, 2 * channelStep, 3 * channelStep, numChannels - 1] : [0, channelStep, 2 * channelStep, 3 * channelStep, 4 * channelStep, numChannels - 1];
            const channelTick = numChannels > 10 ? channelTickPre : Array.from(Array(numChannels).keys());
            channelSlider = (
                <div className="animator-slider">
                    <Radio value={AnimationMode.CHANNEL} disabled={appStore.animatorStore.animationActive} checked={appStore.animatorStore.animationMode === AnimationMode.CHANNEL} onChange={this.onAnimationModeChanged} label="Channel" />
                    {hideSliders && <SafeNumericInput value={activeFrame.requiredChannel} min={-1} max={numChannels} stepSize={1} onValueChange={this.onChannelChanged} fill={true} disabled={appStore.animatorStore.animationActive} />}
                    {!hideSliders && (
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
                                disabled={appStore.animatorStore.animationActive}
                            />
                            <div className="slider-info">
                                <pre>{activeFrame.simpleSpectralInfo}</pre>
                            </div>
                        </React.Fragment>
                    )}
                </div>
            );
            channelRangeSlider = (
                <div className="animator-slider range-slider">
                    <div className="range-label" />
                    {!hideSliders && (
                        <React.Fragment>
                            <RangeSlider
                                value={activeFrame.animationChannelRange}
                                min={0}
                                max={numChannels - 1}
                                labelStepSize={channelStep}
                                labelPrecision={0}
                                onChange={this.onRangeChanged}
                                disabled={appStore.animatorStore.animationActive}
                            />
                            <div className="slider-info" />
                        </React.Fragment>
                    )}
                </div>
            );
        }

        // Stokes Control
        if (numStokes > 1) {
            stokesSlider = (
                <div className={classNames("animator-slider", "stokes-slider", {"tiled-label": this.width < 750})}>
                    <Radio value={AnimationMode.STOKES} disabled={appStore.animatorStore.animationActive} checked={appStore.animatorStore.animationMode === AnimationMode.STOKES} onChange={this.onAnimationModeChanged} label="Polarization" />
                    {hideSliders && (
                        <SafeNumericInput
                            value={activeFrame.requiredStokes}
                            min={-1}
                            max={activeFrame.frameInfo.fileInfoExtended.stokes}
                            stepSize={1}
                            onValueChange={this.onStokesChanged}
                            disabled={appStore.animatorStore.animationActive}
                            fill={true}
                        />
                    )}
                    {!hideSliders && (
                        <React.Fragment>
                            <Slider
                                value={activeFrame.requiredPolarizationIndex}
                                min={0}
                                showTrackFill={false}
                                max={activeFrame.polarizations.length - 1}
                                labelRenderer={(val: number) => {
                                    return isFinite(val) && val >= 0 && val < activeFrame?.polarizationInfo?.length ? activeFrame.polarizationInfo[val] : `${val}`;
                                }}
                                onChange={this.onStokesChanged}
                                disabled={appStore.animatorStore.animationActive}
                            />
                            <div className="slider-info" />
                        </React.Fragment>
                    )}
                </div>
            );
        }

        const playbackClass = classNames("animator-playback", {wrap: hideSliders});
        const playbackModeClass = classNames("playback-mode", {"bp3-dark": appStore.darkTheme});

        const playbackModeButton = (
            <Popover2
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
            >
                <Tooltip2 content="Playback Mode" position={Position.TOP}>
                    <AnchorButton icon={this.getPlayModeIcon()} disabled={appStore.animatorStore.animationActive}>
                        {!iconOnly && "Mode"}
                    </AnchorButton>
                </Tooltip2>
            </Popover2>
        );

        const playbackButtons = (
            <ButtonGroup fill={true} className="playback-buttons">
                <Button icon={"chevron-backward"} onClick={this.onFirstClicked}>
                    {!iconOnly && "First"}
                </Button>
                <Button icon={"step-backward"} onClick={this.onPrevClicked}>
                    {!iconOnly && "Prev"}
                </Button>
                {appStore.animatorStore.animationActive && (
                    <Button icon={"stop"} onClick={appStore.animatorStore.stopAnimation}>
                        {!iconOnly && "Stop"}
                    </Button>
                )}
                {!appStore.animatorStore.animationActive && (
                    <Button icon={"play"} onClick={appStore.animatorStore.startAnimation}>
                        {!iconOnly && "Play"}
                    </Button>
                )}
                <Button icon={"step-forward"} onClick={this.onNextClicked}>
                    {!iconOnly && "Next"}
                </Button>
                <Button icon={"chevron-forward"} onClick={this.onLastClicked}>
                    {!iconOnly && "Last"}
                </Button>
            </ButtonGroup>
        );

        const numericControl = (
            <ControlGroup className="playback-numeric-control">
                <HTMLSelect options={[NumericInputType.FrameRate, NumericInputType.Step]} onChange={ev => this.onNumericInputTypeChange(ev.currentTarget.value as NumericInputType)} />
                {this.numericInputType === NumericInputType.FrameRate ? (
                    <SafeNumericInput
                        value={appStore.animatorStore.frameRate}
                        min={appStore.animatorStore.minFrameRate}
                        max={appStore.animatorStore.maxFrameRate}
                        stepSize={1}
                        minorStepSize={1}
                        majorStepSize={1}
                        onValueChange={appStore.animatorStore.setFrameRate}
                        disabled={appStore.animatorStore.animationActive}
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
                        disabled={appStore.animatorStore.animationActive}
                    />
                )}
            </ControlGroup>
        );

        return (
            <div className="animator-widget">
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
                            {frameSlider}
                            {channelSlider}
                            {channelRangeSlider}
                            {stokesSlider}
                        </div>
                    )}
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}></ReactResizeDetector>
            </div>
        );
    }
}
