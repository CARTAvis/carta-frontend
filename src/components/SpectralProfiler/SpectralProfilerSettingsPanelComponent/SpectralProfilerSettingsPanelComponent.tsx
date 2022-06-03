import * as React from "react";
import { action, computed, autorun, /*observable,*/ makeObservable } from 'mobx';
import {observer} from "mobx-react";
import {FormGroup, HTMLSelect, Switch, Tab, Tabs} from "@blueprintjs/core";
import {LinePlotSettingsPanelComponentProps, LinePlotSettingsPanelComponent, SpectralSettingsComponent, SmoothingSettingsComponent} from "components/Shared";
import {MomentGeneratorComponent} from "../MomentGeneratorComponent/MomentGeneratorComponent";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {WidgetProps, DefaultWidgetConfig, HelpType, AppStore, WidgetsStore} from "stores";
import {parseNumber} from "utilities";
import {ProfileFittingComponent} from "../ProfileFittingComponent/ProfileFittingComponent";
import "./SpectralProfilerSettingsPanelComponent.scss";

const KEYCODE_ENTER = 13;

export enum SpectralProfilerSettingsTabs {
    CONVERSION,
    STYLING,
    SMOOTHING,
    MOMENTS,
    FITTING
}

@observer
export class SpectralProfilerSettingsPanelComponent extends React.Component<WidgetProps> {
    optionalAxisCursorInfoVisible?: boolean;
    
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "spectral-profiler-floating-settings",
            type: "floating-settings",
            minWidth: 280,
            minHeight: 225,
            defaultWidth: 550,
            defaultHeight: 600,
            title: "spectral-profiler-settings",
            isCloseable: true,
            parentId: "spectal-profiler",
            parentType: "spectral-profiler",
            helpType: [
                HelpType.SPECTRAL_PROFILER_SETTINGS_CONVERSION,
                HelpType.SPECTRAL_PROFILER_SETTINGS_STYLING,
                HelpType.SPECTRAL_PROFILER_SETTINGS_SMOOTHING,
                HelpType.SPECTRAL_PROFILER_SETTINGS_MOMENTS,
                HelpType.SPECTRAL_PROFILER_SETTINGS_FITTING
            ]
        };
    }

    @computed get widgetStore(): SpectralProfileWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.spectralProfileWidgets) {
            const widgetStore = widgetsStore.spectralProfileWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return null;
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        this.optionalAxisCursorInfoVisible = false;
        const appStore = AppStore.Instance;
        autorun(() => {
            if (this.widgetStore) {
                const frame = this.widgetStore.effectiveFrame;
                if (frame) {
                    const regionId = this.widgetStore.effectiveRegionId;
                    const regionString = regionId === 0 ? "Cursor" : `Region #${regionId}`;
                    const selectedString = this.widgetStore.matchesSelectedRegion ? "(Active)" : "";
                    appStore.widgetsStore.setWidgetTitle(this.props.floatingSettingsId, `Z Profile Settings: ${regionString} ${selectedString}`);
                }
            }
        });
    }

    @action setCursorInfo(state:boolean){
        this.optionalAxisCursorInfoVisible = state;
    }

    handleOptionalAxisCursorInfoChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.optionalAxisCursorInfoVisible = changeEvent.target.checked;
    };

    handleMeanRmsChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore.setMeanRmsVisible(changeEvent.target.checked);
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
        const lineSettingsProps: LinePlotSettingsPanelComponentProps = {
            lineColorMap: widgetStore.lineColorMap,
            lineOrderedKeys: widgetStore.profileSelectionStore.profileOrderedKeys,
            lineOptions: widgetStore.profileSelectionStore.profileOptions,
            lineWidth: widgetStore.lineWidth,
            plotType: widgetStore.plotType,
            linePlotPointSize: widgetStore.linePlotPointSize,
            setLineColor: widgetStore.setProfileColor,
            setLineWidth: widgetStore.setLineWidth,
            setLinePlotPointSize: widgetStore.setLinePlotPointSize,
            setPlotType: widgetStore.setPlotType,
            meanRmsVisible: widgetStore.meanRmsVisible,
            handleMeanRmsChanged: this.handleMeanRmsChanged,
            isAutoScaledX: widgetStore.isAutoScaledX,
            isAutoScaledY: widgetStore.isAutoScaledY,
            clearXYBounds: widgetStore.clearXYBounds,
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
            <div className="spectral-settings">
                <Tabs id="spectralSettingTabs" selectedTabId={widgetStore.settingsTabId} onChange={this.handleSelectedTabChanged}>
                    <Tab
                        id={SpectralProfilerSettingsTabs.CONVERSION}
                        panelClassName="conversion-tab-panel"
                        title="Conversion"
                        panel={
                            <React.Fragment>
                                <SpectralSettingsComponent
                                    frame={widgetStore.effectiveFrame}
                                    onSpectralCoordinateChange={widgetStore.setSpectralCoordinate}
                                    onSpectralCoordinateChangeSecondary={widgetStore.setSpectralCoordinateSecondary}
                                    onSpectralSystemChange={widgetStore.setSpectralSystem}
                                    optionalAxisCursorInfoVisible={widgetStore.optionalAxisCursorInfoVisible}
                                    disable={widgetStore.effectiveFrame?.isPVImage}
                                />
                                <FormGroup label={"Intensity unit"} inline={true}>
                                    <HTMLSelect disabled={!widgetStore.isIntensityConvertible} value={widgetStore.intensityUnit} options={widgetStore.intensityOptions} onChange={ev => widgetStore.setIntensityUnit(ev.currentTarget.value)} />
                                </FormGroup>
                                <FormGroup inline={true} label={"Optional Info"}>
                                    <Switch checked={widgetStore.optionalAxisCursorInfoVisible} onChange={widgetStore.setOptionalAxisCursorInfoVisible} />
                                </FormGroup>
                                
                            </React.Fragment>
                        }
                    />
                    <Tab id={SpectralProfilerSettingsTabs.STYLING} panelClassName="styling-tab-panel" title="Styling" panel={<LinePlotSettingsPanelComponent {...lineSettingsProps} />} />
                    <Tab id={SpectralProfilerSettingsTabs.SMOOTHING} title="Smoothing" panel={<SmoothingSettingsComponent smoothingStore={widgetStore.smoothingStore} disableColorAndLineWidth={widgetStore.profileNum > 1} />} />
                    <Tab id={SpectralProfilerSettingsTabs.MOMENTS} panelClassName="moment-tab-panel" title="Moments" panel={<MomentGeneratorComponent widgetStore={widgetStore} />} />
                    <Tab id={SpectralProfilerSettingsTabs.FITTING} panelClassName="fitting-tab-panel" title="Fitting" panel={<ProfileFittingComponent fittingStore={widgetStore.fittingStore} widgetStore={widgetStore} />} />
                </Tabs>
            </div>
        );
    }
}
