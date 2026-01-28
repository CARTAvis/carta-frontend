import * as React from "react";
import {Button, ButtonGroup, Checkbox, Classes, Collapse, FormGroup, HTMLSelect, NonIdealState, Position, Slider, Switch, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {AutoColorPickerComponent, fontSelect, ResizeDetector, SafeNumericInput, ScrollShadow} from "components/Shared";
import {AppStore, DefaultWidgetConfig, HelpType, WidgetProps} from "stores";
import {clamp, SWATCH_COLORS} from "utilities";

import "./ChannelMapControlComponent.scss";

@observer
export class ChannelMapControlComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "channel-map-control",
            type: "channel-map-control",
            minWidth: 300,
            minHeight: 200,
            defaultWidth: 490,
            defaultHeight: 600,
            title: "Channel Map Control",
            isCloseable: true,
            helpType: HelpType.CHANNEL_MAP_CONTROL
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
        const channelMapStore = AppStore.Instance.channelMapStore;
        const frame = channelMapStore.displayedFrame;
        if (frame) {
            channelMapStore.setStartChannel(clamp(val, 0, channelMapStore.totalChannelNum - 1));
        }
    };

    public render() {
        const appStore = AppStore.Instance;
        const channelMapSettings = appStore.channelMapStore;
        const displayedFrame = channelMapSettings.displayedFrame;
        const numChannels = displayedFrame ? channelMapSettings.totalChannelNum : 10;
        const iconOnly = this.width < 300;

        const channelMapControl = (
            <div className="channel-map-control-container">
                <FormGroup className="channel-map-control-label" inline={true} label="Enable channel map mode">
                    <Switch checked={channelMapSettings.channelMapEnabled} onChange={ev => channelMapSettings.setChannelMapEnabled(ev.currentTarget.checked)} />
                </FormGroup>
                <div className="channel-map-channel-control">
                    <ButtonGroup fill={true} className="channel-map-channel-control-buttons">
                        <Tooltip content="Previous page" position={Position.TOP} disabled={!channelMapSettings.channelMapEnabled}>
                            <Button icon={"chevron-backward"} onClick={() => appStore.channelMapStore.setPrevPage()} disabled={!channelMapSettings.channelMapEnabled}>
                                {!iconOnly && "Page"}
                            </Button>
                        </Tooltip>
                        <Tooltip content="Previous channel" position={Position.TOP} disabled={!channelMapSettings.channelMapEnabled}>
                            <Button icon={"step-backward"} onClick={() => appStore.channelMapStore.setPrevChannel()} disabled={!channelMapSettings.channelMapEnabled}>
                                {!iconOnly && "Channel"}
                            </Button>
                        </Tooltip>
                        <Tooltip content="Next channel" position={Position.TOP} disabled={!channelMapSettings.channelMapEnabled}>
                            <Button icon={"step-forward"} onClick={() => appStore.channelMapStore.setNextChannel()} disabled={!channelMapSettings.channelMapEnabled}>
                                {!iconOnly && "Channel"}
                            </Button>
                        </Tooltip>
                        <Tooltip content="Next page" position={Position.TOP} disabled={!channelMapSettings.channelMapEnabled}>
                            <Button icon={"chevron-forward"} onClick={() => appStore.channelMapStore.setNextPage()} disabled={!channelMapSettings.channelMapEnabled}>
                                {!iconOnly && "Page"}
                            </Button>
                        </Tooltip>
                    </ButtonGroup>
                </div>
            </div>
        );

        const numLabels = 5;
        const channelStep = numChannels > 10 ? Math.floor((numChannels - 1) / (numLabels - 1)) : 1;
        const channelTickPre = numChannels - 1 - 4 * channelStep < channelStep / 2 ? [0, channelStep, 2 * channelStep, 3 * channelStep, numChannels - 1] : [0, channelStep, 2 * channelStep, 3 * channelStep, 4 * channelStep, numChannels - 1];
        const channelTick = numChannels > 10 ? channelTickPre : Array.from(Array(numChannels).keys());

        const channelMapLabelVisible = channelMapSettings.showChannelString || channelMapSettings.showFrequencyString || channelMapSettings.showVelocityString;

        const channelMapPanel = (
            <div className="channel-map-control-container">
                <FormGroup className="channel-map-control-label" inline={true} label="Start channel" disabled={!channelMapSettings.channelMapEnabled}>
                    <Slider
                        min={0}
                        max={channelMapSettings.totalChannelNum - 1}
                        labelValues={channelTick}
                        stepSize={1}
                        value={appStore.channelMapStore.startChannel}
                        onChange={channel => appStore.channelMapStore.setStartChannel(channel)}
                        disabled={!channelMapSettings.channelMapEnabled || channelMapSettings.totalChannelNum <= 1}
                    />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Image" disabled={!channelMapSettings.channelMapEnabled}>
                    <HTMLSelect
                        value={appStore.imageViewConfigStore.getImageListIndex(channelMapSettings.displayedImage?.type, channelMapSettings.displayedImage?.store.id)}
                        options={AppStore.Instance.imageViewConfigStore.imageNames.map((name, index) => ({value: index, label: `${index}: ${name}`}))}
                        onChange={ev => appStore.setActiveImageByIndex(parseInt(ev.currentTarget.value))}
                        disabled={!channelMapSettings.channelMapEnabled}
                        style={{width: "100px"}}
                        data-testid="image-dropdown"
                    />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Start channel" disabled={!channelMapSettings.channelMapEnabled}>
                    <SafeNumericInput placeholder="Start channel" value={channelMapSettings.startChannel} min={0} max={numChannels - 1} onValueChange={this.onChannelChanged} disabled={!channelMapSettings.channelMapEnabled} />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Number of columns" disabled={!channelMapSettings.channelMapEnabled}>
                    <SafeNumericInput
                        placeholder="Number of columns"
                        min={1}
                        max={10}
                        value={channelMapSettings.numColumns}
                        stepSize={1}
                        onValueChange={(value: number) => channelMapSettings.setNumColumns(value)}
                        disabled={!channelMapSettings.channelMapEnabled}
                    />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Number of rows" disabled={!channelMapSettings.channelMapEnabled}>
                    <SafeNumericInput
                        placeholder="Number of rows"
                        min={1}
                        max={10}
                        value={channelMapSettings.numRows}
                        stepSize={1}
                        onValueChange={(value: number) => channelMapSettings.setNumRows(value)}
                        disabled={!channelMapSettings.channelMapEnabled}
                    />
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Show channel string" disabled={!channelMapSettings.channelMapEnabled}>
                    <div style={{display: "flex", alignItems: "center"}}>
                        <Switch checked={channelMapSettings.showChannelString} onChange={ev => channelMapSettings.setShowChannelString(ev.currentTarget.checked)} disabled={!channelMapSettings.channelMapEnabled} />
                    </div>
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Show frequency string" disabled={!channelMapSettings.channelMapEnabled}>
                    <div style={{display: "flex", alignItems: "center"}}>
                        <Switch checked={channelMapSettings.showFrequencyString} onChange={ev => channelMapSettings.setShowFrequencyString(ev.currentTarget.checked)} disabled={!channelMapSettings.channelMapEnabled} />
                        {channelMapSettings.showFrequencyString && (
                            <Checkbox
                                checked={channelMapSettings.showFrequencyStringUnit}
                                onChange={(ev: React.ChangeEvent<HTMLInputElement>) => channelMapSettings.setShowFrequencyStringUnit(ev.currentTarget.checked)}
                                label="Show unit"
                                style={{marginLeft: "10px"}}
                                disabled={!channelMapSettings.channelMapEnabled}
                            />
                        )}
                    </div>
                </FormGroup>
                <FormGroup className="channel-map-control-label" inline={true} label="Show velocity string" disabled={!channelMapSettings.channelMapEnabled}>
                    <div style={{display: "flex", alignItems: "center"}}>
                        <Switch checked={channelMapSettings.showVelocityString} onChange={ev => channelMapSettings.setShowVelocityString(ev.currentTarget.checked)} disabled={!channelMapSettings.channelMapEnabled} />
                        {channelMapSettings.showVelocityString && (
                            <Checkbox
                                checked={channelMapSettings.showVelocityStringUnit}
                                onChange={(ev: React.ChangeEvent<HTMLInputElement>) => channelMapSettings.setShowVelocityStringUnit(ev.currentTarget.checked)}
                                label="Show unit"
                                style={{marginLeft: "10px"}}
                                disabled={!channelMapSettings.channelMapEnabled}
                            />
                        )}
                    </div>
                </FormGroup>
                <Collapse isOpen={channelMapLabelVisible}>
                    <FormGroup className={classNames("channel-map-control-label", "font-group")} inline={true} label="Font" disabled={!channelMapSettings.channelMapEnabled}>
                        {fontSelect(channelMapSettings.channelMapEnabled, channelMapSettings.font, channelMapSettings.setFont)}
                        <SafeNumericInput
                            min={7}
                            max={96}
                            placeholder="Font size"
                            value={channelMapSettings.fontSize}
                            onValueChange={(value: number) => channelMapSettings.setFontSize(value)}
                            disabled={!channelMapSettings.channelMapEnabled}
                        />
                    </FormGroup>
                    <FormGroup className="channel-map-control-label" inline={true} label="Custom color" disabled={!channelMapSettings.channelMapEnabled}>
                        <Switch checked={channelMapSettings.customColor} onChange={ev => channelMapSettings.setCustomColor(ev.currentTarget.checked)} disabled={!channelMapSettings.channelMapEnabled} />
                    </FormGroup>
                    <Collapse isOpen={channelMapSettings.customColor}>
                        <FormGroup className="channel-map-control-label" inline={true} label="Color" disabled={!channelMapSettings.channelMapEnabled}>
                            <AutoColorPickerComponent color={channelMapSettings.color} presetColors={SWATCH_COLORS} setColor={channelMapSettings.setColor} disableAlpha={true} disabled={!channelMapSettings.channelMapEnabled} />
                        </FormGroup>
                    </Collapse>
                </Collapse>
            </div>
        );

        return (
            <ResizeDetector onResize={this.onResize} throttleTime={33}>
                <div className={classNames("channel-map-control-containers", {[Classes.DARK]: appStore.darkTheme})}>
                    {displayedFrame ? (
                        <ScrollShadow>
                            <div className="channel-map-control-panel">
                                {channelMapControl}
                                {channelMapPanel}
                            </div>
                        </ScrollShadow>
                    ) : (
                        <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                    )}
                </div>
            </ResizeDetector>
        );
    }
}
