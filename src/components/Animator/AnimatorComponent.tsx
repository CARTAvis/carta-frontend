import * as React from "react";
import {observer} from "mobx-react";
import {action, observable} from "mobx";
import {Button, ButtonGroup, FormGroup, IconName, Menu, MenuItem, NonIdealState, NumberRange, NumericInput, Popover, Position, Radio, RangeSlider, Slider, Tooltip} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {AnimationMode, AnimationState, PlayMode, WidgetConfig, WidgetProps, HelpType} from "stores";
import "./AnimatorComponent.css";

@observer
export class AnimatorComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "animator",
            type: "animator",
            minWidth: 250,
            minHeight: 180,
            defaultWidth: 650,
            defaultHeight: 180,
            title: "Animator",
            isCloseable: true,
            helpType: HelpType.ANIMATOR
        };
    }

    @observable width: number;
    @observable height: number;

    @action onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    onChannelChanged = (val: number) => {
        if (this.props.appStore.activeFrame) {
            if (val < 0) {
                val += this.props.appStore.activeFrame.frameInfo.fileInfoExtended.depth;
            }
            if (val >= this.props.appStore.activeFrame.frameInfo.fileInfoExtended.depth) {
                val = 0;
            }
            this.props.appStore.activeFrame.setChannels(val, this.props.appStore.activeFrame.requiredStokes);
        }
    };

    onRangeChanged = (range: NumberRange) => {
        const frame = this.props.appStore.activeFrame;
        if (range && range.length === 2 && frame) {
            if (range[0] >= 0 && range[0] < range[1] && range[1] < frame.frameInfo.fileInfoExtended.depth) {
                frame.setAnimationRange(range);
            }
        }
    };

    onStokesChanged = (val: number) => {
        if (this.props.appStore.activeFrame) {
            if (val < 0) {
                val += this.props.appStore.activeFrame.frameInfo.fileInfoExtended.stokes;
            }
            if (val >= this.props.appStore.activeFrame.frameInfo.fileInfoExtended.stokes) {
                val = 0;
            }
            this.props.appStore.activeFrame.setChannels(this.props.appStore.activeFrame.requiredChannel, val);
        }
    };

    onFrameChanged = (val: number) => {
        if (val < 0) {
            val += this.props.appStore.frames.length;
        }
        if (val >= this.props.appStore.frames.length) {
            val = 0;
        }
        this.props.appStore.setActiveFrameByIndex(val);
    };

    onAnimationModeChanged = (event: React.FormEvent<HTMLInputElement>) => {
        const newMode = parseInt(event.currentTarget.value) as AnimationMode;
        this.props.appStore.animatorStore.setAnimationMode(newMode);
    };

    onFirstClicked = () => {
        const appStore = this.props.appStore;
        const frame = appStore.activeFrame;

        if (!frame) {
            return;
        }

        switch (appStore.animatorStore.animationMode) {
            case AnimationMode.FRAME:
                appStore.setActiveFrameByIndex(0);
                break;
            case AnimationMode.CHANNEL:
                frame.setChannels(0, frame.stokes);
                break;
            case AnimationMode.STOKES:
                frame.setChannels(frame.channel, 0);
                break;
            default:
                break;
        }
    };

    onLastClicked = () => {
        const appStore = this.props.appStore;
        const frame = appStore.activeFrame;

        if (!frame) {
            return;
        }

        switch (appStore.animatorStore.animationMode) {
            case AnimationMode.FRAME:
                appStore.setActiveFrameByIndex(appStore.frames.length - 1);
                break;
            case AnimationMode.CHANNEL:
                frame.setChannels(frame.frameInfo.fileInfoExtended.depth - 1, frame.stokes);
                break;
            case AnimationMode.STOKES:
                frame.setChannels(frame.channel, frame.frameInfo.fileInfoExtended.stokes - 1);
                break;
            default:
                break;
        }
    };

    onNextClicked = () => {
        const appStore = this.props.appStore;
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
        const appStore = this.props.appStore;
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
        const appStore = this.props.appStore;
        switch (appStore.animatorStore.playMode) {
            case PlayMode.FORWARD: default:
                return "arrow-right";
            case PlayMode.BACKWARD:
                return "arrow-left";
            case PlayMode.BOUNCING:
                return "swap-horizontal";
            case PlayMode.BLINK:
                return "exchange";
        }
    };

    private roundToClosestPreferredStep(val: number) {
        const power = Math.floor(Math.log10(val));
        const scaledVal = val / Math.pow(10, power);

        if (scaledVal < 1.5) {
            return 1 * Math.pow(10, power);
        } else if (scaledVal < 3.5) {
            return 2 * Math.pow(10, power);
        } else {
            return 5 * Math.pow(10, power);
        }
    }

    public render() {
        const appStore = this.props.appStore;
        const activeFrame = appStore.activeFrame;
        const dims = activeFrame ? activeFrame.frameInfo.fileInfoExtended.dimensions : 0;
        const numChannels = activeFrame ? activeFrame.frameInfo.fileInfoExtended.depth : 0;
        const numStokes = activeFrame ? activeFrame.frameInfo.fileInfoExtended.stokes : 0;

        const iconOnly = this.width < 600;
        const hideSliders = this.width < 450;

        let channelSlider, channelRangeSlider, stokesSlider, frameSlider;
        // Frame Control
        if (appStore.frames.length > 1) {
            const frameIndex = appStore.frames.findIndex(f => f.frameInfo.fileId === activeFrame.frameInfo.fileId);
            frameSlider = (
                <div className="animator-slider">
                    <Radio
                        value={AnimationMode.FRAME}
                        disabled={appStore.animatorStore.animationState === AnimationState.PLAYING}
                        checked={appStore.animatorStore.animationMode === AnimationMode.FRAME}
                        onChange={this.onAnimationModeChanged}
                        label="Frame"
                    />
                    {hideSliders &&
                    <NumericInput
                        value={frameIndex}
                        min={-1}
                        max={appStore.frames.length}
                        step={1}
                        onValueChange={this.onFrameChanged}
                        fill={true}
                        disabled={appStore.animatorStore.animationState === AnimationState.PLAYING}
                    />
                    }
                    {!hideSliders &&
                    <React.Fragment>
                        <Slider
                            value={frameIndex}
                            min={0}
                            max={appStore.frames.length - 1}
                            showTrackFill={false}
                            stepSize={1}
                            onChange={this.onFrameChanged}
                            disabled={appStore.animatorStore.animationState === AnimationState.PLAYING}
                        />
                        <div className="slider-info">
                            {activeFrame.frameInfo.fileInfo.name}
                        </div>
                    </React.Fragment>
                    }
                </div>
            );
        }

        // Channel Control
        if (numChannels > 1) {
            const numLabels = 5;
            const channelStep = numChannels > 10 ? ((numChannels - 1) / (numLabels - 1)) : 1;
            channelSlider = (
                <div className="animator-slider">
                    <Radio
                        value={AnimationMode.CHANNEL}
                        disabled={appStore.animatorStore.animationState === AnimationState.PLAYING}
                        checked={appStore.animatorStore.animationMode === AnimationMode.CHANNEL}
                        onChange={this.onAnimationModeChanged}
                        label="Channel"
                    />
                    {hideSliders &&
                    <NumericInput
                        value={activeFrame.requiredChannel}
                        min={-1}
                        max={numChannels}
                        step={1}
                        onValueChange={this.onChannelChanged}
                        fill={true}
                        disabled={appStore.animatorStore.animationState === AnimationState.PLAYING}
                    />
                    }
                    {!hideSliders &&
                    <React.Fragment>
                        <Slider
                            className="channel-slider"
                            value={activeFrame.requiredChannel}
                            min={0}
                            max={numChannels - 1}
                            labelStepSize={channelStep}
                            labelPrecision={0}
                            showTrackFill={false}
                            onChange={this.onChannelChanged}
                            disabled={appStore.animatorStore.animationState === AnimationState.PLAYING}
                        />
                        <div className="slider-info">
                            {`Req: ${activeFrame.requiredChannel}; Current: ${activeFrame.channel}`}
                        </div>
                    </React.Fragment>
                    }
                </div>
            );
            channelRangeSlider = (
                <div className="animator-slider range-slider">
                    <div className="range-label"/>
                    {!hideSliders &&
                    <React.Fragment>
                        <RangeSlider
                            value={activeFrame.animationChannelRange}
                            min={0}
                            max={numChannels - 1}
                            labelStepSize={channelStep}
                            labelPrecision={0}
                            onChange={this.onRangeChanged}
                            disabled={appStore.animatorStore.animationState === AnimationState.PLAYING}
                        />
                        <div className="slider-info"/>
                    </React.Fragment>
                    }
                </div>
            );
        }

        // Stokes Control
        if (numStokes > 1) {
            stokesSlider = (
                <div className="animator-slider">
                    <Radio
                        value={AnimationMode.STOKES}
                        disabled={appStore.animatorStore.animationState === AnimationState.PLAYING}
                        checked={appStore.animatorStore.animationMode === AnimationMode.STOKES}
                        onChange={this.onAnimationModeChanged}
                        label="Stokes"
                    />
                    {hideSliders &&
                    <NumericInput
                        value={activeFrame.requiredStokes}
                        min={-1}
                        max={activeFrame.frameInfo.fileInfoExtended.stokes}
                        stepSize={1}
                        onValueChange={this.onStokesChanged}
                        disabled={appStore.animatorStore.animationState === AnimationState.PLAYING}
                        fill={true}
                    />
                    }
                    {!hideSliders &&
                    <React.Fragment>
                        <Slider
                            value={activeFrame.requiredStokes}
                            min={0}
                            showTrackFill={false}
                            max={activeFrame.frameInfo.fileInfoExtended.stokes - 1}
                            onChange={this.onStokesChanged}
                            disabled={appStore.animatorStore.animationState === AnimationState.PLAYING}
                        />
                        <div className="slider-info">
                            {`Req: ${activeFrame.requiredStokes}; Current: ${activeFrame.stokes}`}
                        </div>
                    </React.Fragment>
                    }
                </div>
            );
        }

        let playbackClass = "animator-playback";
        if (hideSliders) {
            playbackClass += " wrap";
        }

        const playbackModeButton = (
            <Popover
                className="playback-mode"
                content={
                    <Menu>
                        <MenuItem icon="arrow-right" text="Play Forward" active={appStore.animatorStore.playMode === PlayMode.FORWARD} onClick={() => appStore.animatorStore.playMode = PlayMode.FORWARD}/>
                        <MenuItem icon="arrow-left" text="Play Backwards" active={appStore.animatorStore.playMode === PlayMode.BACKWARD} onClick={() => appStore.animatorStore.playMode = PlayMode.BACKWARD}/>
                        <MenuItem icon="swap-horizontal" text="Bouncing" active={appStore.animatorStore.playMode === PlayMode.BOUNCING} onClick={() => appStore.animatorStore.playMode = PlayMode.BOUNCING}/>
                        <MenuItem icon="exchange" text="Blink" active={appStore.animatorStore.playMode === PlayMode.BLINK} onClick={() => appStore.animatorStore.playMode = PlayMode.BLINK}/>
                    </Menu>
                }
                position={Position.TOP}
            >
                <Tooltip content="Playback Mode" position={Position.TOP}>
                    <Button icon={this.getPlayModeIcon()} disabled={appStore.animatorStore.animationState === AnimationState.PLAYING}>{!iconOnly && "Mode"}</Button>
                </Tooltip>
            </Popover>
        );

        const playbackButtons = (
            <ButtonGroup fill={true} className="playback-buttons">
                <Button icon={"chevron-backward"} onClick={this.onFirstClicked}>{!iconOnly && "First"}</Button>
                <Button icon={"step-backward"} onClick={this.onPrevClicked}>{!iconOnly && "Prev"}</Button>
                {appStore.animatorStore.animationState === AnimationState.PLAYING &&
                <Button icon={"stop"} onClick={appStore.animatorStore.stopAnimation}>{!iconOnly && "Stop"}</Button>
                }
                {appStore.animatorStore.animationState === AnimationState.STOPPED &&
                <Button icon={"play"} onClick={appStore.animatorStore.startAnimation}>{!iconOnly && "Play"}</Button>
                }
                <Button icon={"step-forward"} onClick={this.onNextClicked}>{!iconOnly && "Next"}</Button>
                <Button icon={"chevron-forward"} onClick={this.onLastClicked}>{!iconOnly && "Last"}</Button>
            </ButtonGroup>
        );

        const frameControl = (
            <FormGroup label="Frame rate" inline={true} className="playback-framerate">
                <NumericInput
                    id="framerate-numeric"
                    value={appStore.animatorStore.frameRate}
                    min={appStore.animatorStore.minFrameRate}
                    max={appStore.animatorStore.maxFrameRate}
                    stepSize={1}
                    minorStepSize={1}
                    majorStepSize={1}
                    onValueChange={appStore.animatorStore.setFrameRate}
                    disabled={appStore.animatorStore.animationState === AnimationState.PLAYING}
                />
            </FormGroup>
        );

        return (
            <div className="animator-widget">
                {!activeFrame &&
                <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>
                }
                {activeFrame &&
                <div className={playbackClass}>
                    {playbackButtons}
                    {playbackModeButton}
                    {frameControl}
                </div>
                }
                {activeFrame &&
                <div className="animator-sliders">
                    {frameSlider}
                    {channelSlider}
                    {channelRangeSlider}
                    {stokesSlider}
                </div>
                }
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}