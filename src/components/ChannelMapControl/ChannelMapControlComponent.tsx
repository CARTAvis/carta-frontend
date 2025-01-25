import * as React from "react";
import {Button, ButtonGroup, Checkbox, FormGroup, HTMLSelect, Position, Slider, Switch, Tooltip} from "@blueprintjs/core";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {ResizeDetector, SafeNumericInput, ScrollShadow} from "components/Shared";
import {AppStore, DefaultWidgetConfig, WidgetProps} from "stores";
import {clamp} from "utilities";

import "./ChannelMapControlComponent.scss";

@observer
export class ChannelMapControlComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "channel-map-control",
            type: "channel-map-control",
            minWidth: 450,
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

    @action onChannelChanged = (val: number) => {
        const channelMapSettings = AppStore.Instance.channelMapStore;
        const frame = channelMapSettings.masterFrame;
        if (frame) {
            channelMapSettings.setStartChannel(clamp(val, 0, frame.frameInfo.fileInfoExtended.depth));
        }
    };

    public render() {
        const appStore = AppStore.Instance;
        const activeFrame = appStore.activeFrame;
        const channelMapSettings = appStore.channelMapStore;
        const numChannels = channelMapSettings.masterFrame ? channelMapSettings.masterFrame.frameInfo.fileInfoExtended.depth : 10;
        const iconOnly = this.width < 300;

        const channelMapControl = (
            <div className="channel-map-control-container">
                <div className="channel-map-channel-control">
                    <ButtonGroup fill={true} className="channel-map-channel-control-buttons">
                        <Tooltip content="Previous page" position={Position.TOP}>
                            <Button icon={"chevron-backward"} onClick={() => appStore.channelMapStore.setPrevPage()}>
                                {!iconOnly && "Page"}
                            </Button>
                        </Tooltip>
                        <Tooltip content="Previous channel" position={Position.TOP}>
                            <Button icon={"step-backward"} onClick={() => appStore.channelMapStore.setPrevChannel()}>
                                {!iconOnly && "Channel"}
                            </Button>
                        </Tooltip>
                        <Tooltip content="Next channel" position={Position.TOP}>
                            <Button icon={"step-forward"} onClick={() => appStore.channelMapStore.setNextChannel()}>
                                {!iconOnly && "Channel"}
                            </Button>
                        </Tooltip>
                        <Tooltip content="Next page" position={Position.TOP}>
                            <Button icon={"chevron-forward"} onClick={() => appStore.channelMapStore.setNextPage()}>
                                {!iconOnly && "Page"}
                            </Button>
                        </Tooltip>
                    </ButtonGroup>
                </div>
            </div>
        );

        const channelMapPanel = (
            <div className="channel-map-control-container">
                <FormGroup className="channel-map-control-label" inline={true} label="Start channel">
                    <Slider
                        min={0}
                        max={appStore.channelMapStore.masterFrame?.frameInfo.fileInfoExtended.depth}
                        stepSize={1}
                        labelStepSize={Math.max(appStore.channelMapStore.masterFrame?.frameInfo.fileInfoExtended.depth / appStore.channelMapStore.numChannels, appStore.channelMapStore.masterFrame?.frameInfo.fileInfoExtended.depth / 5)}
                        value={appStore.channelMapStore.startChannel}
                        onChange={channel => appStore.channelMapStore.setStartChannel(channel)}
                    />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Image">
                    <HTMLSelect
                        options={appStore.frameNames}
                        value={channelMapSettings.masterFrame ? appStore.frames.indexOf(channelMapSettings.masterFrame) : -1}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => channelMapSettings.setMasterFrame(AppStore.Instance.getFrame(parseInt(event.currentTarget.value)))}
                    />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Start channel">
                    <SafeNumericInput placeholder="Start channel" value={channelMapSettings.startChannel} min={0} max={numChannels - 1} onValueChange={this.onChannelChanged} />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Number of columns">
                    <SafeNumericInput placeholder="Number of columns" min={1} max={10} value={channelMapSettings.numColumns} stepSize={1} onValueChange={(value: number) => channelMapSettings.setNumColumns(value)} />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Number of rows">
                    <SafeNumericInput placeholder="Number of rows" min={1} max={10} value={channelMapSettings.numRows} stepSize={1} onValueChange={(value: number) => channelMapSettings.setNumRows(value)} />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Show channel string">
                    <div style={{display: "flex", alignItems: "center"}}>
                        <Switch checked={channelMapSettings.showChannelString} onChange={ev => channelMapSettings.setShowChannelString(ev.currentTarget.checked)} />
                        {channelMapSettings.showChannelString && (
                            <Checkbox
                                checked={channelMapSettings.showChannelStringLabel}
                                onChange={(ev: React.ChangeEvent<HTMLInputElement>) => channelMapSettings.setShowChannelStringLabel(ev.currentTarget.checked)}
                                label="Show label"
                                style={{marginLeft: "10px"}}
                            />
                        )}
                    </div>
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Show spectral string">
                    <div style={{display: "flex", alignItems: "center"}}>
                        <Switch checked={channelMapSettings.showSpectralString} onChange={ev => channelMapSettings.setShowSpectralString(ev.currentTarget.checked)} />
                        {channelMapSettings.showSpectralString && (
                            <Checkbox
                                checked={channelMapSettings.showSpectralStringLabel}
                                onChange={(ev: React.ChangeEvent<HTMLInputElement>) => channelMapSettings.setShowSpectralStringLabel(ev.currentTarget.checked)}
                                label="Show label"
                                style={{marginLeft: "10px"}}
                            />
                        )}
                    </div>
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Show velocity string">
                    <div style={{display: "flex", alignItems: "center"}}>
                        <Switch checked={channelMapSettings.showVelocityString} onChange={ev => channelMapSettings.setShowVelocityString(ev.currentTarget.checked)} />
                        {channelMapSettings.showVelocityString && (
                            <Checkbox
                                checked={channelMapSettings.showVelocityStringLabel}
                                onChange={(ev: React.ChangeEvent<HTMLInputElement>) => channelMapSettings.setShowVelocityStringLabel(ev.currentTarget.checked)}
                                label="Show label"
                                style={{marginLeft: "10px"}}
                            />
                        )}
                    </div>
                </FormGroup>
            </div>
        );

        return (
            <ResizeDetector onResize={this.onResize} throttleTime={33}>
                <ScrollShadow>
                    <div className="channel-map-control-containers">
                        {activeFrame && (
                            <div className="channel-map-sliders">
                                {channelMapControl}
                                {channelMapPanel}
                            </div>
                        )}
                    </div>
                </ScrollShadow>
            </ResizeDetector>
        );
    }
}
