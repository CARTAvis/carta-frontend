import * as React from "react";
import ReactResizeDetector from "react-resize-detector";
import {Button, ButtonGroup, FormGroup, HTMLSelect, NonIdealState, Position, Slider, Switch, Tooltip} from "@blueprintjs/core";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {SafeNumericInput} from "components/Shared";
import {AppStore, DefaultWidgetConfig, WidgetProps} from "stores";

import "./ChannelMapControlComponent.scss";

@observer
export class ChannelMapControlComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "channel-map-control",
            type: "channel-map-control",
            minWidth: 250,
            minHeight: 200,
            defaultWidth: 480,
            defaultHeight: 600,
            title: "Channel Map Control",
            isCloseable: true
        };
    }

    @observable width: number;
    @observable height: number;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @action onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    public render() {
        const appStore = AppStore.Instance;
        const activeFrame = appStore.activeFrame;
        const channelMapSettings = appStore.channelMapStore;
        const numChannels = channelMapSettings.masterFrame ? channelMapSettings.masterFrame.frameInfo.fileInfoExtended.depth : 10;
        const iconOnly = this.width < 300;

        const onChannelChanged = (val: number) => {
            const frame = channelMapSettings.masterFrame;
            if (frame) {
                if (val < 0) {
                    val += frame.frameInfo.fileInfoExtended.depth;
                }
                if (val >= frame.frameInfo.fileInfoExtended.depth) {
                    val = 0;
                }
                channelMapSettings.setStartChannel(val);
            }
        };

        const channelMapControl = (
            <div className="channel-map-control-container">
                <div className="channel-map-channel-control">
                    <ButtonGroup fill={true} className="channel-map-channel-control-buttons">
                        <Tooltip content="Previous page" position={Position.TOP}>
                            <Button icon={"chevron-backward"} onClick={() => appStore.channelMapStore.setPrevPage()} data-testid="">
                                {!iconOnly && "Page"}
                            </Button>
                        </Tooltip>
                        <Tooltip content="Previous channel" position={Position.TOP}>
                            <Button icon={"step-backward"} onClick={() => appStore.channelMapStore.setPrevChannel()} data-testid="">
                                {!iconOnly && "Channel"}
                            </Button>
                        </Tooltip>
                        <Tooltip content="Next channel" position={Position.TOP}>
                            <Button icon={"step-forward"} onClick={() => appStore.channelMapStore.setNextChannel()} data-testid="">
                                {!iconOnly && "Channel"}
                            </Button>
                        </Tooltip>
                        <Tooltip content="Next page" position={Position.TOP}>
                            <Button icon={"chevron-forward"} onClick={() => appStore.channelMapStore.setNextPage()} data-testid="">
                                {!iconOnly && "Page"}
                            </Button>
                        </Tooltip>
                    </ButtonGroup>
                </div>
                <div className="channel-map-start-channel-slider" data-testid="">
                    <label className="channel-map-control-label bp5-label">Start Channel</label>
                    <Slider
                        min={0}
                        max={appStore.channelMapStore.masterFrame?.frameInfo.fileInfoExtended.depth}
                        stepSize={1}
                        labelStepSize={Math.max(appStore.channelMapStore.masterFrame?.frameInfo.fileInfoExtended.depth / appStore.channelMapStore.numChannels, appStore.channelMapStore.masterFrame?.frameInfo.fileInfoExtended.depth / 9)}
                        value={appStore.channelMapStore.startChannel}
                        onChange={channel => appStore.channelMapStore.throttledSetStartChannels(channel)}
                    />
                </div>
            </div>
        );

        const channelMapPanel = (
            <div className="channel-map-control-container">
                <FormGroup className="channel-map-control-label" inline={true} label="Image">
                    <HTMLSelect
                        options={appStore.frameNames}
                        value={channelMapSettings.masterFrame ? appStore.frames.indexOf(channelMapSettings.masterFrame) : -1}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => channelMapSettings.setMasterFrame(AppStore.Instance.getFrame(parseInt(event.currentTarget.value)))}
                    />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Start Channel">
                    <SafeNumericInput placeholder="Start channel" value={channelMapSettings.startChannel} min={0} max={numChannels - 1} onValueChange={onChannelChanged} />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Number of Columns">
                    <SafeNumericInput placeholder="Number of Columns" min={1} max={10} value={channelMapSettings.numColumns} stepSize={1} onValueChange={(value: number) => channelMapSettings.setNumColumns(value)} />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Number of Rows">
                    <SafeNumericInput placeholder="Number of Rows" min={1} max={10} value={channelMapSettings.numRows} stepSize={1} onValueChange={(value: number) => channelMapSettings.setNumRows(value)} />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Single Channel Contour">
                    <Switch checked={channelMapSettings.singleChannelContour} onChange={ev => channelMapSettings.setSingleChannelContour(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Contour Channel" disabled={!channelMapSettings.singleChannelContour}>
                    <SafeNumericInput
                        placeholder="Contour Channel"
                        disabled={!channelMapSettings.singleChannelContour}
                        min={0}
                        max={channelMapSettings.masterFrame?.frameInfo.fileInfoExtended.depth - 1 || 0}
                        value={channelMapSettings.singleContourChannel}
                        stepSize={1}
                        onValueChange={(value: number) => channelMapSettings.setSingleContourChannel(value)}
                    />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Auxiliary Frame Visible">
                    <Switch checked={channelMapSettings.showAuxiliaryFrame} onChange={ev => channelMapSettings.setShowAuxiliaryFrame(ev.currentTarget.checked)} />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Auxiliary Frame Channel" disabled={!channelMapSettings.showAuxiliaryFrame}>
                    <SafeNumericInput
                        placeholder="Auxiliary Frame Channel"
                        disabled={!channelMapSettings.showAuxiliaryFrame}
                        min={0}
                        max={channelMapSettings.auxiliaryFrame?.frameInfo.fileInfoExtended.depth - 1 || 0}
                        value={channelMapSettings.auxiliaryFrameChannel}
                        stepSize={1}
                        onValueChange={(value: number) => channelMapSettings.setAuxiliaryFrameChannel(value)}
                    />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Auxiliary Image" disabled={!channelMapSettings.showAuxiliaryFrame}>
                    <HTMLSelect
                        options={channelMapSettings.masterFrame?.spatialSiblings.map(matchedFrame => {
                            return {label: matchedFrame.filename, value: matchedFrame.frameInfo.fileId};
                        })}
                        value={channelMapSettings.masterFrame ? channelMapSettings.auxiliaryFrame?.filename : -1}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => channelMapSettings.setAuxiliaryFrame(AppStore.Instance.getFrame(parseInt(event.currentTarget.value)))}
                        disabled={!channelMapSettings.showAuxiliaryFrame}
                    />
                </FormGroup>
            </div>
        );

        return (
            <div className="channel-map-control-containers">
                {!appStore.preferenceStore.channelMapEnabled && <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />}
                {appStore.preferenceStore.channelMapEnabled &&
                    activeFrame &&
                    this.width > 0 && ( // temporary fix for broken range slider, issue #1078
                        <div className="channel-map-sliders">
                            {appStore.preferenceStore.channelMapEnabled && appStore.channelMapStore.masterFrame && channelMapControl}
                            {appStore.preferenceStore.channelMapEnabled && appStore.channelMapStore.masterFrame && channelMapPanel}
                        </div>
                    )}
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}></ReactResizeDetector>
            </div>
        );
    }
}
