import * as React from "react";
import {AnchorButton, Button, ButtonGroup, Classes, ControlGroup, HTMLSelect, type IconName, Menu, MenuItem, NonIdealState, type NumberRange, PopoverNext, Position, Pre, Radio, RangeSlider, Slider, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {ResizeDetector, SafeNumericInput, ScrollShadow} from "components/Shared";
import {AnimationMode, HelpType, NumericInputType, PlayMode, RelativeTimeReference, TimeLabelFormat, TimeScale, TimeZoneMode} from "enums";
import {AnimatorStore, AppStore, DEFAULT_ANIMATOR_WIDGET_CONFIG, type DefaultWidgetConfig, type WidgetProps} from "stores";
import {formatTimeSeriesTickLabels, getDiscreteSliderTicks, type TimeLabelSettings, toFixed} from "utilities";

import "./AnimatorComponent.scss";

function getTimeLabelFormatName(settings: TimeLabelSettings): string {
    switch (settings.timeLabelFormat) {
        case TimeLabelFormat.ISO:
            if (settings.timeZoneMode === TimeZoneMode.LOCAL) {
                return "ISO 8601 (local)";
            }
            if (settings.timeZoneMode === TimeZoneMode.IANA) {
                return `ISO 8601 (${settings.ianaTimeZone ?? "UTC"})`;
            }
            return "ISO 8601 (UTC)";
        case TimeLabelFormat.MJD:
            return `MJD (${settings.timeScale ?? TimeScale.UTC})`;
        case TimeLabelFormat.JD:
            return `JD (${settings.timeScale ?? TimeScale.UTC})`;
        case TimeLabelFormat.RELATIVE: {
            const scale = settings.timeScale ?? TimeScale.UTC;
            if (settings.relativeTimeReference === RelativeTimeReference.IMAGE) {
                return `Relative to selected image (${scale})`;
            }
            if (settings.relativeTimeReference === RelativeTimeReference.CUSTOM) {
                return `Relative to custom epoch (${scale})`;
            }
            return `Relative to first observation (${scale})`;
        }
        case TimeLabelFormat.AUTO:
        default:
            return "Auto (UTC)";
    }
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

    onTimeChanged = (val: number) => {
        const timeSeriesStore = AppStore.Instance.timeSeriesStore;
        const count = timeSeriesStore.elements.length;
        if (count > 0) {
            if (val < 0) {
                val += count;
            }
            if (val >= count) {
                val = 0;
            }
            timeSeriesStore.setIndex(val);
        }
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
            case AnimationMode.TIME:
                appStore.timeSeriesStore.first();
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
            case AnimationMode.TIME:
                appStore.timeSeriesStore.last();
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
            case AnimationMode.TIME:
                appStore.timeSeriesStore.next();
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
            case AnimationMode.TIME:
                appStore.timeSeriesStore.prev();
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
        const shouldHideSliders = this.width < 450;
        const animatorWidgetStore = appStore.widgetsStore.animatorWidgets.get(this.props.id);
        const sliderSettings = animatorWidgetStore ?? DEFAULT_ANIMATOR_WIDGET_CONFIG;
        const timeSeriesStore = appStore.timeSeriesStore;
        const timeSeriesElements = timeSeriesStore.elements;
        const numTimes = timeSeriesElements.length;
        const shouldAddTimeSliderSpacing = !shouldHideSliders && this.width < 750 && numTimes > 1 && sliderSettings.isTimeSliderVisible;

        let channelSlider, channelRangeSlider, stokesSlider, imageSlider, timeSlider;
        // Image Control
        const imageIndex = appStore.activeImageIndex;
        if (numImages > 1 && imageIndex !== -1 && sliderSettings.isImageSliderVisible) {
            const {values: imageTick} = getDiscreteSliderTicks(numImages);
            imageSlider = (
                <div className="animator-slider">
                    <Radio value={AnimationMode.FRAME} disabled={appStore.animatorStore.isAnimationActive} checked={appStore.animatorStore.animationMode === AnimationMode.FRAME} onChange={this.onAnimationModeChanged} label="Image" />
                    {shouldHideSliders && <SafeNumericInput value={imageIndex} min={-1} max={numImages} stepSize={1} onValueChange={this.onImageChanged} fill={true} disabled={appStore.animatorStore.isAnimationActive} />}
                    {!shouldHideSliders && appStore.activeImage?.store.filename && (
                        <React.Fragment>
                            <Slider value={imageIndex} min={0} max={numImages - 1} showTrackFill={false} labelValues={imageTick} labelPrecision={0} onChange={this.onImageChanged} disabled={appStore.animatorStore.isAnimationActive} />
                            <div className="slider-info">{appStore.activeImage.store.filename}</div>
                        </React.Fragment>
                    )}
                </div>
            );
        }

        // Channel Control
        if (numChannels > 1 && activeFrame && sliderSettings.isChannelSliderVisible) {
            const {values: channelTick, step: channelStep} = getDiscreteSliderTicks(numChannels);
            channelSlider = (
                <div className="animator-slider" data-testid="animator-slider">
                    <Radio
                        value={AnimationMode.CHANNEL}
                        disabled={appStore.animatorStore.isAnimationActive}
                        checked={appStore.animatorStore.animationMode === AnimationMode.CHANNEL}
                        onChange={this.onAnimationModeChanged}
                        label={activeFrame.channelType}
                    />
                    {shouldHideSliders && (
                        <SafeNumericInput value={activeFrame.requiredChannel} min={-1} max={numChannels} stepSize={1} onValueChange={this.onChannelChanged} fill={true} disabled={appStore.animatorStore.isAnimationActive} />
                    )}
                    {!shouldHideSliders && (
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
                    {!shouldHideSliders && (
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
        if (numStokes > 1 && activeFrame && sliderSettings.isStokesSliderVisible) {
            stokesSlider = (
                <div className={classNames("animator-slider", "stokes-slider", {"tiled-label": this.width < 750, "has-time-slider-below": shouldAddTimeSliderSpacing})} data-testid="animator-polarization-slider">
                    <Radio
                        value={AnimationMode.STOKES}
                        disabled={appStore.animatorStore.isAnimationActive}
                        checked={appStore.animatorStore.animationMode === AnimationMode.STOKES}
                        onChange={this.onAnimationModeChanged}
                        label="Polarization"
                    />
                    {shouldHideSliders && (
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
                    {!shouldHideSliders && (
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

        // Time series control
        if (numTimes > 1 && sliderSettings.isTimeSliderVisible) {
            const currentTimeIndex = timeSeriesStore.currentIndex;
            const {values: timeTick} = getDiscreteSliderTicks(numTimes, currentTimeIndex);
            const timeTickLabels = formatTimeSeriesTickLabels(timeSeriesElements, sliderSettings);
            const timeLabelFormatName = getTimeLabelFormatName(sliderSettings);
            const renderTimeTickLabel = (index: number) => {
                const element = timeSeriesElements[index];
                if (!element) {
                    return "";
                }
                const tooltipContent = (
                    <div className="time-series-tooltip">
                        <div className="time-series-tooltip-filename">{element.frame.filename}</div>
                        <dl>
                            <dt>ISO (UTC)</dt>
                            <dd>{element.isoUtc}</dd>
                            <dt>MJD (UTC)</dt>
                            <dd>{toFixed(element.mjdUtc, 6)}</dd>
                            <dt>{timeLabelFormatName}</dt>
                            <dd>{timeTickLabels[index]}</dd>
                        </dl>
                    </div>
                );
                return (
                    <Tooltip content={tooltipContent} position={Position.TOP}>
                        <span className={classNames("time-tick-label", {"is-selected": index === currentTimeIndex})}>{timeTickLabels[index]}</span>
                    </Tooltip>
                );
            };
            timeSlider = (
                <div className={classNames("animator-slider", "time-slider", "angled-labels", {"long-time-labels": sliderSettings.timeLabelFormat === TimeLabelFormat.ISO})} data-testid="animator-time-slider">
                    <Radio
                        value={AnimationMode.TIME}
                        disabled={appStore.animatorStore.isAnimationActive}
                        checked={appStore.animatorStore.animationMode === AnimationMode.TIME}
                        onChange={this.onAnimationModeChanged}
                        labelElement={
                            <Tooltip content={`${numTimes} spatially matched images sorted by observation time (UTC). Tick labels: ${timeLabelFormatName}.`} position={Position.TOP}>
                                <span>Time</span>
                            </Tooltip>
                        }
                    />
                    {shouldHideSliders && (
                        <SafeNumericInput
                            value={currentTimeIndex >= 0 ? currentTimeIndex : undefined}
                            min={-1}
                            max={numTimes}
                            stepSize={1}
                            onValueChange={this.onTimeChanged}
                            fill={true}
                            disabled={appStore.animatorStore.isAnimationActive}
                        />
                    )}
                    {!shouldHideSliders && (
                        <React.Fragment>
                            <Slider
                                className={classNames({"is-outside-series": currentTimeIndex < 0})}
                                value={Math.max(0, currentTimeIndex)}
                                min={0}
                                max={numTimes - 1}
                                labelValues={timeTick}
                                labelRenderer={renderTimeTickLabel}
                                showTrackFill={false}
                                onChange={this.onTimeChanged}
                                disabled={appStore.animatorStore.isAnimationActive}
                            />
                            <div className="slider-info time-slider-spacer" aria-hidden={true} />
                        </React.Fragment>
                    )}
                </div>
            );
        }

        const hasAnimationControls = Boolean(imageSlider || channelSlider || stokesSlider || timeSlider);

        const playbackClass = classNames("animator-playback", {wrap: shouldHideSliders});
        const playbackModeClass = classNames("playback-mode", {[Classes.DARK]: appStore.isDarkTheme});

        const playbackModeButton = (
            <PopoverNext
                className={playbackModeClass}
                content={
                    <Menu>
                        <MenuItem icon="arrow-right" text="Play forward" active={appStore.animatorStore.playMode === PlayMode.FORWARD} onClick={() => (appStore.animatorStore.playMode = PlayMode.FORWARD)} />
                        <MenuItem icon="arrow-left" text="Play backwards" active={appStore.animatorStore.playMode === PlayMode.BACKWARD} onClick={() => (appStore.animatorStore.playMode = PlayMode.BACKWARD)} />
                        <MenuItem icon="swap-horizontal" text="Bouncing" active={appStore.animatorStore.playMode === PlayMode.BOUNCING} onClick={() => (appStore.animatorStore.playMode = PlayMode.BOUNCING)} />
                        <MenuItem icon="exchange" text="Blink" active={appStore.animatorStore.playMode === PlayMode.BLINK} onClick={() => (appStore.animatorStore.playMode = PlayMode.BLINK)} />
                    </Menu>
                }
                placement="top"
                shouldReturnFocusOnClose={false}
                disabled={!hasAnimationControls || appStore.channelMapStore.isChannelMapEnabled}
            >
                <Tooltip content="Playback mode" position={Position.TOP}>
                    <AnchorButton icon={this.getPlayModeIcon()} disabled={!hasAnimationControls || appStore.animatorStore.isAnimationActive || appStore.channelMapStore.isChannelMapEnabled} data-testid="animator-playback-mode-button">
                        {!isIconOnly && "Mode"}
                    </AnchorButton>
                </Tooltip>
            </PopoverNext>
        );

        const playbackButtons = (
            <ButtonGroup fill={true} className="playback-buttons">
                <Button icon={"chevron-backward"} onClick={this.onFirstClicked} disabled={!hasAnimationControls} data-testid="animator-first-button">
                    {!isIconOnly && "First"}
                </Button>
                <Button icon={"step-backward"} onClick={this.onPrevClicked} disabled={!hasAnimationControls} data-testid="animator-previous-button">
                    {!isIconOnly && "Prev"}
                </Button>
                {appStore.animatorStore.isAnimationActive && (
                    <Button icon={"stop"} onClick={appStore.animatorStore.stopAnimation} disabled={appStore.channelMapStore.isChannelMapEnabled} data-testid="animator-play-stop-button">
                        {!isIconOnly && "Stop"}
                    </Button>
                )}
                {!appStore.animatorStore.isAnimationActive && (
                    <Button
                        icon={"play"}
                        onClick={appStore.animatorStore.startAnimation}
                        disabled={!hasAnimationControls || appStore.animatorStore.shouldStartAnimationDisable || appStore.channelMapStore.isChannelMapEnabled}
                        data-testid="animator-play-stop-button"
                    >
                        {!isIconOnly && "Play"}
                    </Button>
                )}
                <Button icon={"step-forward"} onClick={this.onNextClicked} disabled={!hasAnimationControls} data-testid="animator-next-button">
                    {!isIconOnly && "Next"}
                </Button>
                <Button icon={"chevron-forward"} onClick={this.onLastClicked} disabled={!hasAnimationControls} data-testid="animator-last-button">
                    {!isIconOnly && "Last"}
                </Button>
            </ButtonGroup>
        );

        const numericControl = (
            <ControlGroup className="playback-numeric-control">
                <HTMLSelect
                    disabled={!hasAnimationControls || appStore.animatorStore.isAnimationActive || appStore.channelMapStore.isChannelMapEnabled}
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
                        disabled={!hasAnimationControls || appStore.animatorStore.isAnimationActive || appStore.channelMapStore.isChannelMapEnabled}
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
                        disabled={!hasAnimationControls || appStore.animatorStore.isAnimationActive || appStore.channelMapStore.isChannelMapEnabled}
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
                                    {timeSlider}
                                </div>
                            )}
                    </ScrollShadow>
                </div>
            </ResizeDetector>
        );
    }
}
