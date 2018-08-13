import * as React from "react";
import {observer} from "mobx-react";
import "./AnimatorComponent.css";
import {AppStore} from "../../stores/AppStore";
import {WidgetConfig} from "../../stores/FloatingWidgetStore";
import {NonIdealState, Slider} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {FrameStore} from "../../stores/FrameStore";

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
            minHeight: 225,
            defaultWidth: 650,
            defaultHeight: 225,
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

    private roundToClosestPreferredStep(val) {
        if (val < 0.15) {
            return 0.1 * this.roundToClosestPreferredStep(val * 10);
        }
        if (val < 1.5) {
            return 1;
        }
        else if (val < 3.5) {
            return 2;
        }
        else if (val < 7.5) {
            return 5;
        }
        else if (val < 15) {
            return 10;
        }
        else {
            return 10 * this.roundToClosestPreferredStep(val / 10);
        }
    }

    public render() {
        const appStore = this.props.appStore;
        const activeFrame = appStore.activeFrame;
        const dims = activeFrame ? activeFrame.frameInfo.fileInfoExtended.dimensions : 0;

        let channelSlider, stokesSlider, frameSlider;

        // Frame Control
        if (appStore.frames.length > 1) {
            const frameIndex = appStore.frames.findIndex(f => f.frameInfo.fileId === activeFrame.frameInfo.fileId);
            frameSlider = (
                <div className="animator-slider">
                    <div className="slider-label">Frame</div>
                    <Slider value={frameIndex} min={0} max={appStore.frames.length - 1} onChange={this.onFrameChanged}/>
                    <div className="slider-info">
                        {activeFrame.frameInfo.fileInfo.name}
                    </div>
                </div>
            );
        }

        // Channel Control
        if (dims >= 3) {
            const numChannels = activeFrame.frameInfo.fileInfoExtended.depth;
            const channelStep = this.roundToClosestPreferredStep(numChannels / 10);
            channelSlider = (
                <div className="animator-slider">
                    <div className="slider-label">Channel</div>
                    <Slider value={activeFrame.requiredChannel} min={0} max={activeFrame.frameInfo.fileInfoExtended.depth - 1} labelStepSize={channelStep} onChange={this.onChannelChanged}/>
                    <div className="slider-info">
                        {`Req: ${activeFrame.requiredChannel}; Current: ${activeFrame.channel}`}
                    </div>
                </div>
            );
        }

        // Stokes Control
        if (dims == 4) {
            stokesSlider = (
                <div className="animator-slider">
                    <div className="slider-label">Stokes</div>
                    <Slider value={activeFrame.requiredStokes} min={0} max={activeFrame.frameInfo.fileInfoExtended.stokes - 1} onChange={this.onStokesChanged}/>
                    <div className="slider-info">
                        {`Req: ${activeFrame.requiredStokes}; Current: ${activeFrame.stokes}`}
                    </div>
                </div>
            );
        }

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
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}