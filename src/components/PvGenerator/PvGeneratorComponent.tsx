import * as React from "react";
import ReactResizeDetector from "react-resize-detector";
import {AnchorButton, FormGroup, HTMLSelect, Position, Switch, Tab, TabId, Tabs} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {TaskProgressDialogComponent} from "components/Dialogs";
import {SafeNumericInput, SpectralSettingsComponent} from "components/Shared";
import {Point2D, SpectralSystem} from "models";
import {AppStore, DefaultWidgetConfig, HelpType, WidgetProps, WidgetsStore} from "stores";
import {PVAxis, PvGeneratorWidgetStore, RegionId} from "stores/Widgets";
import {toFixed} from "utilities";

import "./PvGeneratorComponent.scss";

export enum PvGeneratorComponentTabs {
    PV_IMAGE,
    PREVIEW_CUBE
}

@observer
export class PvGeneratorComponent extends React.Component<WidgetProps> {
    @observable selectedTabId: TabId = PvGeneratorComponentTabs.PV_IMAGE;
    axesOrder = {};
    @observable isValidSpectralRange: boolean = true;

    @action private setSelectedTab = (tab: TabId) => {
        this.selectedTabId = tab;
    };

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "pv-generator",
            type: "pv-generator",
            minWidth: 350,
            minHeight: 500,
            defaultWidth: 500,
            defaultHeight: 620,
            title: "PV Generator",
            isCloseable: true,
            helpType: HelpType.PV_GENERATOR
        };
    }

    @observable width: number;
    @observable height: number;

    @computed get widgetStore(): PvGeneratorWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.pvGeneratorWidgets) {
            const widgetStore = widgetsStore.pvGeneratorWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new PvGeneratorWidgetStore();
    }

    @computed get isLineIntersectedWithImage(): boolean {
        if (this.widgetStore.effectiveRegion) {
            const startPoint = this.widgetStore.effectiveRegion.controlPoints[0];
            const endPoint = this.widgetStore.effectiveRegion.controlPoints[1];
            const width = this.widgetStore.effectiveFrame.frameInfo.fileInfoExtended.width;
            const height = this.widgetStore.effectiveFrame.frameInfo.fileInfoExtended.height;
            const imageCorners: Point2D[] = [
                {x: -0.5, y: -0.5},
                {x: width - 0.5, y: -0.5},
                {x: -0.5, y: height - 0.5},
                {x: width - 0.5, y: height - 0.5}
            ];

            // check if image corners are on the same side of the line region. from https://stackoverflow.com/a/1560510
            let sideValue = 0;
            for (let corner of imageCorners) {
                sideValue = sideValue + Math.sign((endPoint.x - startPoint.x) * (corner.y - startPoint.y) - (endPoint.y - startPoint.y) * (corner.x - startPoint.x));
            }

            if (sideValue <= 2 && sideValue >= -2) {
                // check if start/end points are outside image
                if ((startPoint.x < -0.5 && endPoint.x < -0.5) || (startPoint.y < -0.5 && endPoint.y < -0.5) || (startPoint.x > width - 0.5 && endPoint.x > width - 0.5) || (startPoint.y > height - 0.5 && endPoint.y > height - 0.5)) {
                    return false;
                }

                return true;
            }
        }
        return false;
    }

    @computed get isLineInOnePixel(): boolean {
        if (this.widgetStore.effectiveRegion) {
            const startPoint = this.widgetStore.effectiveRegion.controlPoints[0];
            const endPoint = this.widgetStore.effectiveRegion.controlPoints[1];
            if (Math.round(startPoint.x) === Math.round(endPoint.x) && Math.round(startPoint.y) === Math.round(endPoint.y)) {
                return true;
            }
        }
        return false;
    }

    @computed get estimatedCubeSize(): {value: number; unit: string; bitValue: number} {
        const bitPix = Math.abs(this.widgetStore?.effectiveFrame?.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.match("BITPIX")).numericValue);
        const region = this.widgetStore.effectiveFrame?.getRegion(this.widgetStore.effectivePreviewRegionId);
        const imageDepth = this.widgetStore?.effectiveFrame?.frameInfo.fileInfoExtended.depth;
        const estimatedSize = (region?.size.x * region?.size.y * bitPix * imageDepth) / (this.widgetStore.xyRebin * this.widgetStore.zRebin);
        if (region?.regionType !== CARTA.RegionType.RECTANGLE || !estimatedSize) {
            return undefined;
        }
        let value: number;
        let unit: string;
        if (estimatedSize >= 1e12) {
            value = parseInt(toFixed(estimatedSize / 1e12, 2));
            unit = "TB";
        } else if (estimatedSize >= 1e9) {
            value = parseInt(toFixed(estimatedSize / 1e9, 1));
            unit = "GB";
        } else if (estimatedSize >= 1e6) {
            value = parseInt(toFixed(estimatedSize / 1e6, 1));
            unit = "MB";
        } else if (estimatedSize >= 1e3) {
            value = parseInt(toFixed(estimatedSize / 1e3, 1));
            unit = "kB";
        } else {
            value = estimatedSize;
            unit = "B";
        }
        return {value, unit, bitValue: estimatedSize};
    }

    @computed get isCubeSizeBelowLimit(): boolean {
        return this.estimatedCubeSize?.bitValue < 10 * 1e9;
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);
        this.genAxisOptions();
        const appStore = AppStore.Instance;
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === PvGeneratorComponent.WIDGET_CONFIG.type) {
            // Assign the next unique ID
            const id = appStore.widgetsStore.addPvGeneratorWidget();
            appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!appStore.widgetsStore.pvGeneratorWidgets.has(this.props.id)) {
                console.log(`can't find store for widget with id=${this.props.id}`);
                appStore.widgetsStore.pvGeneratorWidgets.set(this.props.id, new PvGeneratorWidgetStore());
            }
        }
    }

    @action private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    @action setisValidSpectralRange = (bool: boolean) => {
        this.isValidSpectralRange = bool;
    };

    private handleFrameChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        if (this.widgetStore.effectiveFrame) {
            const selectedFileId = parseInt(changeEvent.target.value);
            this.widgetStore.setFileId(selectedFileId);
            this.widgetStore.setRegionId(this.widgetStore.effectiveFrame.frameInfo.fileId, RegionId.ACTIVE);
        }
    };

    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        if (this.widgetStore.effectiveFrame) {
            const fileId = this.widgetStore.effectiveFrame.frameInfo.fileId;
            this.widgetStore.setFileId(fileId);
            this.widgetStore.setRegionId(fileId, parseInt(changeEvent.target.value));
        }
    };

    private handlePreviewRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        if (this.widgetStore.effectiveFrame) {
            this.widgetStore.setPreviewRegionId(parseInt(changeEvent.target.value));
        }
    };

    private handleAxesOrderChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        if (this.axesOrder["reverse"] === changeEvent.target.value) {
            this.widgetStore.setReverse(true);
        } else {
            this.widgetStore.setReverse(false);
        }
    };

    private onPreviewButtonClicked = () => {
        this.widgetStore.requestPV(true, this.props.id);
    };

    private onGenerateButtonClicked = () => {
        const fileId = this.widgetStore.effectiveFrame.frameInfo.fileId;
        this.widgetStore.setFileId(fileId);
        this.widgetStore.setRegionId(fileId, this.widgetStore.effectiveRegionId);
        this.widgetStore.requestPV();
    };

    private genAxisOptions = () => {
        const axes = Object.values(PVAxis);

        for (const xAxis of axes) {
            for (const yAxis of axes) {
                if (xAxis !== yAxis) {
                    if (xAxis === PVAxis.SPATIAL) {
                        this.axesOrder["default"] = `X-axis: ${xAxis}, Y-axis: ${yAxis}`;
                    } else {
                        this.axesOrder["reverse"] = `X-axis: ${xAxis}, Y-axis: ${yAxis}`;
                    }
                }
            }
        }
    };

    private handleSpectralRangeChanged = (value: number, max: boolean) => {
        if (max) {
            this.widgetStore.setSpectralRange({min: this.widgetStore.range?.min, max: value ?? null});
        } else {
            this.widgetStore.setSpectralRange({min: value ?? null, max: this.widgetStore.range?.max});
        }

        const frame = this.widgetStore.effectiveFrame;
        let channelIndexMin = frame.findChannelIndexByValue(this.widgetStore.range?.min);
        let channelIndexMax = frame.findChannelIndexByValue(this.widgetStore.range?.max);

        if (channelIndexMin > channelIndexMax) {
            const holder = channelIndexMax;
            channelIndexMax = channelIndexMin;
            channelIndexMin = holder;
        }

        if (isFinite(this.widgetStore.range?.min) && isFinite(this.widgetStore.range?.max) && channelIndexMin < channelIndexMax && channelIndexMax < frame.numChannels) {
            this.setisValidSpectralRange(true);
        } else {
            this.setisValidSpectralRange(false);
        }
    };

    render() {
        const appStore = AppStore.Instance;
        const frame = this.widgetStore.effectiveFrame;
        const fileInfo = frame ? `${appStore.getFrameIndex(frame.frameInfo.fileId)}: ${frame.filename}` : undefined;
        const regionInfo = this.widgetStore.effectiveRegionInfo;

        let selectedValue = RegionId.ACTIVE;
        if (this.widgetStore.effectiveFrame?.regionSet) {
            selectedValue = this.widgetStore.regionIdMap.get(this.widgetStore.effectiveFrame.frameInfo.fileId);
        }

        const isAbleToGenerate = this.widgetStore.effectiveRegion && !appStore.animatorStore.animationActive && this.isLineIntersectedWithImage && !this.isLineInOnePixel && this.isValidSpectralRange;
        const isAbleToGeneratePreview = isAbleToGenerate && this.isCubeSizeBelowLimit;
        const hint = (
            <span>
                <i>
                    <small>
                        Please ensure:
                        <br />
                        1. Animation playback is stopped.
                        <br />
                        2. Line region is selected.
                        <br />
                        3. Line region has intersection with image.
                        <br />
                        4. Line region is not in one pixel.
                    </small>
                </i>
            </span>
        );

        const previewHint = (
            <span>
                <i>
                    <small>
                        Please ensure:
                        <br />
                        1. Reactangle region is selected.
                        <br />
                        2. Preview cube size is less than the threshold.
                    </small>
                </i>
            </span>
        );

        const pvImagePanel = (
            <div className="pv-image-panel">
                <FormGroup
                    className="label-info-group"
                    inline={true}
                    label="Image"
                    labelInfo={
                        <span className="label-info" title={fileInfo}>
                            {fileInfo ? `(${fileInfo})` : ""}
                        </span>
                    }
                >
                    <HTMLSelect value={this.widgetStore.fileId} options={this.widgetStore.frameOptions} onChange={this.handleFrameChanged} />
                </FormGroup>
                <FormGroup
                    className="label-info-group"
                    inline={true}
                    label="Region"
                    labelInfo={
                        <span className="label-info" title={regionInfo}>
                            {regionInfo ? `(${regionInfo})` : ""}
                        </span>
                    }
                >
                    <HTMLSelect value={selectedValue} options={this.widgetStore.regionOptions} onChange={this.handleRegionChanged} />
                </FormGroup>
                <FormGroup inline={true} label="Average Width">
                    <SafeNumericInput min={1} max={20} stepSize={1} value={this.widgetStore.width} onValueChange={value => this.widgetStore.setWidth(value)} />
                </FormGroup>
                <SpectralSettingsComponent
                    frame={frame}
                    onSpectralCoordinateChange={coord => {
                        this.setisValidSpectralRange(true);
                        this.widgetStore.setSpectralCoordinate(coord);
                    }}
                    onSpectralSystemChange={sys => {
                        this.setisValidSpectralRange(true);
                        this.widgetStore.setSpectralSystem(sys as SpectralSystem);
                    }}
                    disable={frame?.isPVImage}
                />
                {frame && frame.numChannels > 1 && (
                    <FormGroup label="Range" inline={true} labelInfo={`(${frame.spectralUnit})`}>
                        <div className="range-select">
                            <FormGroup label="From" inline={true}>
                                <SafeNumericInput value={this.widgetStore.range?.min} buttonPosition="none" onValueChange={value => this.handleSpectralRangeChanged(value, false)} />
                            </FormGroup>
                            <FormGroup label="To" inline={true}>
                                <SafeNumericInput value={this.widgetStore.range?.max} buttonPosition="none" onValueChange={value => this.handleSpectralRangeChanged(value, true)} />
                            </FormGroup>
                        </div>
                    </FormGroup>
                )}
                <FormGroup className="label-info-group" inline={true} label="Axes Order">
                    <HTMLSelect options={Object.values(this.axesOrder)} onChange={this.handleAxesOrderChanged} />
                </FormGroup>
                <FormGroup inline={true} label={"Keep previous PV Image"}>
                    <Switch
                        onChange={event => {
                            const e = event.target as HTMLInputElement;
                            this.widgetStore.setKeep(e.checked);
                        }}
                    />
                </FormGroup>

                <FormGroup className="label-info-group" inline={true} label="Preview Region">
                    <HTMLSelect options={this.widgetStore.previewRegionOptions} onChange={this.handlePreviewRegionChanged} />
                </FormGroup>

                <FormGroup className="label-info-group" inline={true} label="Preview Rebin" labelInfo={`(px)`}>
                    <div className="rebin-select">
                        <FormGroup inline={true} label={"XY"}>
                            <SafeNumericInput
                                min={1}
                                max={Math.ceil(Math.max(this.widgetStore.effectiveFrame?.frameInfo.fileInfoExtended.height, this.widgetStore.effectiveFrame?.frameInfo.fileInfoExtended.width) / 2) || 1}
                                stepSize={1}
                                value={this.widgetStore.xyRebin}
                                onValueChange={value => this.widgetStore.setXYRebin(value)}
                            />
                        </FormGroup>
                        <FormGroup inline={true} label={"Z"}>
                            <SafeNumericInput
                                min={1}
                                max={Math.ceil(this.widgetStore.effectiveFrame?.frameInfo.fileInfoExtended.depth / 2) || 1}
                                stepSize={1}
                                value={this.widgetStore.zRebin}
                                onValueChange={value => this.widgetStore.setZRebin(value)}
                            />
                        </FormGroup>
                    </div>
                </FormGroup>
                <div className="cube-size-button-group">
                    <FormGroup className="cube-size-group" inline label="Preview Cube Size" labelInfo={this.estimatedCubeSize ? `(${this.estimatedCubeSize.unit})` : ""} disabled={!this.estimatedCubeSize}>
                        <label className="cube-size">{`${this.estimatedCubeSize?.value || ""}`}</label>
                    </FormGroup>
                    <div className="generate-button">
                        <div>
                            <Tooltip2 disabled={isAbleToGenerate} content={previewHint} position={Position.BOTTOM}>
                                <AnchorButton intent="success" disabled={!isAbleToGeneratePreview} text="Start Preview" onClick={this.onPreviewButtonClicked} />
                            </Tooltip2>
                        </div>
                        <div>
                            <Tooltip2 disabled={isAbleToGenerate} content={hint} position={Position.BOTTOM}>
                                <AnchorButton intent="success" disabled={!isAbleToGenerate} text="Generate" onClick={this.onGenerateButtonClicked} />
                            </Tooltip2>
                        </div>
                    </div>
                </div>
            </div>
        );

        return (
            <div className="pv-generator-widget">
                <div className="pv-generator-panel">
                    <Tabs id="pvGeneratorTabs" selectedTabId={this.selectedTabId} onChange={this.setSelectedTab} animate={false}>
                        <Tab id={PvGeneratorComponentTabs.PV_IMAGE} title="Generate PV image" panel={pvImagePanel} />
                    </Tabs>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}></ReactResizeDetector>
                <TaskProgressDialogComponent
                    isOpen={frame?.isRequestingPV && frame.requestingPVProgress < 1}
                    progress={frame ? frame.requestingPVProgress : 0}
                    timeRemaining={appStore.estimatedTaskRemainingTime}
                    cancellable={true}
                    onCancel={this.widgetStore.requestingPVCancelled(this.props.id)}
                    text={"Generating PV"}
                    isCancelling={frame?.isRequestPVCancelling}
                />
            </div>
        );
    }
}
