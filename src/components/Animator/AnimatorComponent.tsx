import * as React from "react";
import {observer} from "mobx-react";
import "./AnimatorComponent.css";
import {AppStore} from "../../stores/AppStore";
import {WidgetConfig} from "../../stores/FloatingWidgetStore";
import {Button, ButtonGroup, FormGroup, NonIdealState, NumericInput, Radio, RadioGroup, Slider} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {AnimationMode} from "../../stores/AnimatorStore";

class CubeControlsComponentProps {
    appStore: AppStore;
    id: string;
    docked: boolean;
}

class CubeControlsComponentState {
    width: number;
    height: number;
}

@observer
export class AnimatorComponent extends React.Component<CubeControlsComponentProps, CubeControlsComponentState> {

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "animator",
            type: "animator",
            minWidth: 250,
            minHeight: 180,
            defaultWidth: 650,
            defaultHeight: 180,
            title: "Animator",
            isCloseable: true
        };
    }

    constructor(props: CubeControlsComponentProps) {
        super(props);
        this.state = {width: 0, height: 0};
    }

    onResize = (width: number, height: number) => {
        this.setState({width, height});
    };

    onChannelChanged = (val: number) => {
        if (this.props.appStore.activeFrame) {
            this.props.appStore.activeFrame.setChannels(val, this.props.appStore.activeFrame.requiredStokes);
        }
    };

    onStokesChanged = (val: number) => {
        if (this.props.appStore.activeFrame) {
            this.props.appStore.activeFrame.setChannels(this.props.appStore.activeFrame.requiredChannel, val);
        }
    };

    onFrameChanged = (val: number) => {
        this.props.appStore.setActiveFrameByIndex(val);
    };

    onAnimationModeChanged = (event: React.FormEvent<HTMLInputElement>) => {
        const newMode = parseInt(event.currentTarget.value) as AnimationMode;
        this.props.appStore.animatorStore.setAnimationMode(newMode);
    };

    private roundToClosestPreferredStep(val: number) {
        const power = Math.floor(Math.log10(val));
        const scaledVal = val / Math.pow(10, power);

        if (scaledVal < 1.5) {
            return 1 * Math.pow(10, power);
        }
        else if (scaledVal < 3.5) {
            return 2 * Math.pow(10, power);
        }
        else {
            return 5 * Math.pow(10, power);
        }
    }

    public render() {
        const appStore = this.props.appStore;
        const activeFrame = appStore.activeFrame;
        const dims = activeFrame ? activeFrame.frameInfo.fileInfoExtended.dimensions : 0;
        const numChannels = activeFrame ? activeFrame.frameInfo.fileInfoExtended.depth : 0;
        const numStokes = activeFrame ? activeFrame.frameInfo.fileInfoExtended.stokes : 0;

        const iconOnly = this.state.width < 600;
        const hideSliders = this.state.width < 450;

        let channelSlider, stokesSlider, frameSlider;
        // Frame Control
        if (appStore.frames.length > 1) {
            const frameIndex = appStore.frames.findIndex(f => f.frameInfo.fileId === activeFrame.frameInfo.fileId);
            frameSlider = (
                <div className="animator-slider">
                    <Radio value={AnimationMode.FRAME} checked={appStore.animatorStore.animationMode === AnimationMode.FRAME} onChange={this.onAnimationModeChanged} label="Frame"/>
                    {hideSliders &&
                    <NumericInput value={frameIndex} min={0} max={appStore.frames.length - 1} step={1} onValueChange={this.onFrameChanged} fill={true}/>
                    }
                    {!hideSliders &&
                    <React.Fragment>
                        <Slider value={frameIndex} min={0} max={appStore.frames.length - 1} onChange={this.onFrameChanged}/>
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
            const numLabels = 10;
            const channelStep = this.roundToClosestPreferredStep(numChannels / numLabels);
            channelSlider = (
                <div className="animator-slider">
                    <Radio value={AnimationMode.CHANNEL} checked={appStore.animatorStore.animationMode === AnimationMode.CHANNEL} onChange={this.onAnimationModeChanged} label="Channel"/>
                    {hideSliders &&
                    <NumericInput value={activeFrame.requiredChannel} min={0} max={numChannels - 1} step={1} onValueChange={this.onChannelChanged} fill={true}/>
                    }
                    {!hideSliders &&
                    <React.Fragment>
                        <Slider value={activeFrame.requiredChannel} min={0} max={numChannels - 1} labelStepSize={channelStep} onChange={this.onChannelChanged}/>
                        <div className="slider-info">
                            {`Req: ${activeFrame.requiredChannel}; Current: ${activeFrame.channel}`}
                        </div>
                    </React.Fragment>
                    }
                </div>
            );
        }

        // Stokes Control
        if (numStokes > 1) {
            stokesSlider = (
                <div className="animator-slider">
                    <Radio value={AnimationMode.STOKES} checked={appStore.animatorStore.animationMode === AnimationMode.STOKES} onChange={this.onAnimationModeChanged} label="Stokes"/>
                    {hideSliders &&
                    <NumericInput value={appStore.animatorStore.frameRate} min={appStore.animatorStore.minFrameRate} max={appStore.animatorStore.maxFrameRate} stepSize={1} fill={true}/>
                    }
                    {!hideSliders &&
                    <React.Fragment>
                        <Slider value={activeFrame.requiredStokes} min={0} max={activeFrame.frameInfo.fileInfoExtended.stokes - 1} onChange={this.onStokesChanged}/>
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

        const playbackButtons = (
            <ButtonGroup fill={true} className="playback-buttons">
                <Button icon={"chevron-backward"}>{!iconOnly && "First"}</Button>
                <Button icon={"step-backward"}>{!iconOnly && "Prev"}</Button>
                <Button icon={"stop"}>{!iconOnly && "Stop"}</Button>
                <Button icon={"play"}>{!iconOnly && "Play"}</Button>
                <Button icon={"step-forward"}>{!iconOnly && "Next"}</Button>
                <Button icon={"chevron-forward"}>{!iconOnly && "Last"}</Button>
            </ButtonGroup>
        );

        const frameControl = (
            <FormGroup label="Frame rate" inline={true} className="playback-framerate">
                <NumericInput id="framerate-numeric" value={appStore.animatorStore.frameRate} min={appStore.animatorStore.minFrameRate} max={appStore.animatorStore.maxFrameRate} stepSize={1}/>
            </FormGroup>
        );

        return (
            <div className="animator-container">
                {!activeFrame &&
                <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>
                }
                {activeFrame &&
                <div className="animator-sliders">
                    {frameSlider}
                    {channelSlider}
                    {stokesSlider}
                </div>
                }
                {activeFrame &&
                <div className={playbackClass}>
                    {playbackButtons}
                    {frameControl}
                </div>
                }
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}