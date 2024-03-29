import * as React from "react";
import {FormGroup, Tab, Tabs} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {autorun, computed} from "mobx";
import {observer} from "mobx-react";

import {LinePlotSettingsPanelComponent, LinePlotSettingsPanelComponentProps, SafeNumericInput, SmoothingSettingsComponent} from "components/Shared";
import {LineKey} from "models";
import {AppStore, DefaultWidgetConfig, HelpType, WidgetProps, WidgetsStore} from "stores";
import {RegionId, SpatialProfileWidgetStore} from "stores/Widgets";
import {parseNumber} from "utilities";

import "./SpatialProfilerSettingsPanelComponent.scss";

const KEYCODE_ENTER = 13;

export enum SpatialProfilerSettingsTabs {
    STYLING,
    SMOOTHING,
    COMPUTATION
}

@observer
export class SpatialProfilerSettingsPanelComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "spatial-profiler-floating-settings",
            type: "floating-settings",
            minWidth: 280,
            minHeight: 225,
            defaultWidth: 400,
            defaultHeight: 450,
            title: "spatial-profiler-settings",
            isCloseable: true,
            parentId: "spatial-profiler",
            parentType: "spatial-profiler",
            helpType: [HelpType.SPATIAL_PROFILER_SETTINGS_STYLING, HelpType.SPATIAL_PROFILER_SETTINGS_SMOOTHING, HelpType.SPATIAL_PROFILER_SETTINGS_COMPUTATION]
        };
    }

    @computed get widgetStore(): SpatialProfileWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.spatialProfileWidgets) {
            const widgetStore = widgetsStore.spatialProfileWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return null;
    }

    constructor(props: WidgetProps) {
        super(props);
        const appStore = AppStore.Instance;
        // Update widget title when region or coordinate changes
        autorun(() => {
            if (this.widgetStore) {
                const coordinate = this.widgetStore.coordinate;
                if (appStore && coordinate) {
                    const coordinateString = this.widgetStore.isLineOrPolyline ? "" : coordinate.toUpperCase();
                    const regionString = this.widgetStore.effectiveRegionId === RegionId.CURSOR ? "Cursor" : `Region #${this.widgetStore.effectiveRegionId}`;
                    appStore.widgetsStore.setWidgetTitle(this.props.floatingSettingsId, `${coordinateString} Spatial Profile Settings: ${regionString}`);
                }
            } else {
                appStore.widgetsStore.setWidgetTitle(this.props.floatingSettingsId, `X Spatial Profile Settings: Cursor`);
            }
        });
    }

    handleWcsAxisChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore.setWcsAxisVisible(changeEvent.target.checked);
    };

    handleMeanRmsChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore.setMeanRmsVisible(changeEvent.target.checked);
    };

    handleCoordinateChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.widgetStore.setCoordinate(changeEvent.target.value);
    };

    handleXMinChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        const minX = parseNumber(widgetStore.minX, widgetStore.linePlotInitXYBoundaries.minXVal);
        const maxX = parseNumber(widgetStore.maxX, widgetStore.linePlotInitXYBoundaries.maxXVal);
        if (isFinite(val) && val !== minX && val < maxX) {
            widgetStore.setXBounds(val, maxX);
        } else {
            ev.currentTarget.value = minX.toString();
        }
    };

    handleXMaxChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        const minX = parseNumber(widgetStore.minX, widgetStore.linePlotInitXYBoundaries.minXVal);
        const maxX = parseNumber(widgetStore.maxX, widgetStore.linePlotInitXYBoundaries.maxXVal);
        if (isFinite(val) && val !== maxX && val > minX) {
            widgetStore.setXBounds(minX, val);
        } else {
            ev.currentTarget.value = maxX.toString();
        }
    };

    handleYMinChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        const minY = parseNumber(widgetStore.minY, widgetStore.linePlotInitXYBoundaries.minYVal);
        const maxY = parseNumber(widgetStore.maxY, widgetStore.linePlotInitXYBoundaries.maxYVal);
        if (isFinite(val) && val !== minY && val < maxY) {
            widgetStore.setYBounds(val, maxY);
        } else {
            ev.currentTarget.value = minY.toString();
        }
    };

    handleYMaxChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        const minY = parseNumber(widgetStore.minY, widgetStore.linePlotInitXYBoundaries.minYVal);
        const maxY = parseNumber(widgetStore.maxY, widgetStore.linePlotInitXYBoundaries.maxYVal);
        if (isFinite(val) && val !== maxY && val > minY) {
            widgetStore.setYBounds(minY, val);
        } else {
            ev.currentTarget.value = maxY.toString();
        }
    };

    handleSelectedTabChanged = (newTabId: React.ReactText) => {
        this.widgetStore.setSettingsTabId(Number.parseInt(newTabId.toString()));
    };

    render() {
        const widgetStore = this.widgetStore;
        const lineRegionSampleWidth = this.widgetStore.effectiveRegion?.lineRegionSampleWidth;
        const profileCoordinateOptions = [
            {
                value: "x",
                label: "X"
            },
            {
                value: "y",
                label: "Y"
            }
        ];

        const lineSettingsProps: LinePlotSettingsPanelComponentProps = {
            lineColorMap: new Map<LineKey, string>([["Primary", widgetStore.primaryLineColor]]),
            lineOptions: [{value: "Primary", label: "Primary"}],
            lineWidth: widgetStore.lineWidth,
            plotType: widgetStore.plotType,
            linePlotPointSize: widgetStore.linePlotPointSize,
            showWCSAxis: widgetStore.wcsAxisVisible,
            disableShowWCSAxis: this.widgetStore.effectiveRegion ? this.widgetStore.effectiveRegion.regionType !== CARTA.RegionType.POINT : false,
            setLineColor: (lineKey: LineKey, color: string) => widgetStore.setPrimaryLineColor(color),
            setLineWidth: widgetStore.setLineWidth,
            setLinePlotPointSize: widgetStore.setLinePlotPointSize,
            handleWcsAxisChanged: this.handleWcsAxisChanged,
            setPlotType: widgetStore.setPlotType,
            meanRmsVisible: widgetStore.meanRmsVisible,
            handleMeanRmsChanged: this.handleMeanRmsChanged,
            isAutoScaledX: widgetStore.isAutoScaledX,
            isAutoScaledY: widgetStore.isAutoScaledY,
            clearXYBounds: widgetStore.clearXYBounds,
            userSelectedCoordinate: widgetStore.coordinate,
            handleCoordinateChanged: this.handleCoordinateChanged,
            profileCoordinateOptions: profileCoordinateOptions,
            xMinVal: parseNumber(widgetStore.minX, widgetStore.linePlotInitXYBoundaries.minXVal),
            handleXMinChange: this.handleXMinChange,
            xMaxVal: parseNumber(widgetStore.maxX, widgetStore.linePlotInitXYBoundaries.maxXVal),
            handleXMaxChange: this.handleXMaxChange,
            yMinVal: parseNumber(widgetStore.minY, widgetStore.linePlotInitXYBoundaries.minYVal),
            handleYMinChange: this.handleYMinChange,
            yMaxVal: parseNumber(widgetStore.maxY, widgetStore.linePlotInitXYBoundaries.maxYVal),
            handleYMaxChange: this.handleYMaxChange
        };
        return (
            <div className="spatial-profiler-settings">
                <Tabs id="spatialSettingTabs" selectedTabId={widgetStore.settingsTabId} onChange={this.handleSelectedTabChanged}>
                    <Tab id={SpatialProfilerSettingsTabs.STYLING} title="Styling" panel={<LinePlotSettingsPanelComponent {...lineSettingsProps} />} />
                    <Tab id={SpatialProfilerSettingsTabs.SMOOTHING} title="Smoothing" panel={<SmoothingSettingsComponent smoothingStore={widgetStore.smoothingStore} />} />
                    <Tab
                        id={SpatialProfilerSettingsTabs.COMPUTATION}
                        title="Computation"
                        panel={
                            <FormGroup label={"Width"} inline={true}>
                                <SafeNumericInput min={1} max={20} stepSize={1} disabled={!widgetStore.effectiveRegion} value={lineRegionSampleWidth} onValueChange={value => widgetStore.setLineRegionSampleWidth(value)} />
                            </FormGroup>
                        }
                    />
                </Tabs>
            </div>
        );
    }
}
