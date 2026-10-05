import * as React from "react";
import {FormGroup, HTMLSelect, Icon, Intent, Position, Switch, Tab, Tabs, Tooltip} from "@blueprintjs/core";
import {action, autorun, type IReactionDisposer, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {LinePlotSettingsPanelComponent, type LinePlotSettingsPanelComponentProps, SafeNumericInput, ScrollShadow, SmoothingSettingsComponent, SpectralSettingsComponent} from "components/Shared";
import {HelpType, MultiProfileCategory, PreferenceKeys, RestFrameShiftMode, SpectralProfilerSettingsTabs, VelocityConvention} from "enums";
import {AppStore, type DefaultWidgetConfig, type WidgetProps, WidgetsStore} from "stores";
import {type SpectralProfileWidgetStore} from "stores/Widgets";
import {parseNumber, restFrameShiftValidationMessage} from "utilities";

import {MomentGeneratorComponent} from "../MomentGeneratorComponent/MomentGeneratorComponent";
import {ProfileFittingComponent} from "../ProfileFittingComponent/ProfileFittingComponent";

import "./SpectralProfilerSettingsPanelComponent.scss";

@observer
export class SpectralProfilerSettingsPanelComponent extends React.Component<WidgetProps> {
    private widgetId: string;
    private floatingSettingsId: string | undefined;
    private cachedWidgetStore: SpectralProfileWidgetStore | null = null;
    private readonly disposers: IReactionDisposer[] = [];
    @observable private shiftInputIntent: Intent = Intent.NONE;

    public static get WidgetConfig(): DefaultWidgetConfig {
        return {
            id: "spectral-profiler-floating-settings",
            type: "floating-settings",
            minWidth: 450,
            minHeight: 400,
            defaultWidth: 575,
            defaultHeight: 650,
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

    get widgetStore(): SpectralProfileWidgetStore | null {
        if (!this.cachedWidgetStore) {
            this.cachedWidgetStore = WidgetsStore.Instance.spectralProfileWidgets.get(this.widgetId) ?? null;
        }
        return this.cachedWidgetStore;
    }

    constructor(props: WidgetProps) {
        super(props);
        this.widgetId = props.id;
        this.floatingSettingsId = props.floatingSettingsId;
        makeObservable(this);

        const appStore = AppStore.Instance;
        this.disposers.push(
            autorun(() => {
                if (this.widgetStore) {
                    const frame = this.widgetStore.effectiveFrame;
                    if (frame) {
                        const regionId = this.widgetStore.effectiveRegionId;
                        const regionString = regionId === 0 ? "Cursor" : `Region #${regionId}`;
                        const selectedString = this.widgetStore.isMatchingSelectedRegion ? "(Active)" : "";
                        const id = this.floatingSettingsId;
                        if (id) {
                            appStore.widgetsStore.setWidgetTitle(id, `Z Profile Settings: ${regionString} ${selectedString}`);
                        }
                    }
                }
            })
        );
    }

    componentWillUnmount() {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
    }

    handleMeanRmsChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore?.setMeanRmsVisible(changeEvent.target.checked);
    };

    @action private onShiftChanged = (value: number) => {
        const widgetStore = this.widgetStore;
        if (!widgetStore) {
            return;
        }

        const isValid = widgetStore.setRestFrameShift(value);
        this.shiftInputIntent = isValid ? Intent.NONE : Intent.DANGER;
    };

    @action private onShiftModeChanged = (mode: string) => {
        this.widgetStore?.setRestFrameShiftMode(mode as RestFrameShiftMode);
        AppStore.Instance.preferenceStore.setPreference(PreferenceKeys.SILENT_SPECTRAL_PROFILER_REST_FRAME_SHIFT_MODE, mode as RestFrameShiftMode);
        this.shiftInputIntent = Intent.NONE;
    };

    @action private onVelocityConventionChanged = (convention: string) => {
        this.widgetStore?.setRestFrameVelocityConvention(convention as VelocityConvention);
        AppStore.Instance.preferenceStore.setPreference(PreferenceKeys.SILENT_SPECTRAL_PROFILER_REST_FRAME_VELOCITY_CONVENTION, convention as VelocityConvention);
        this.shiftInputIntent = Intent.NONE;
    };

    handleXMinChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.key !== "Enter") {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        const minX = parseNumber(widgetStore?.minX, widgetStore?.linePlotInitXYBoundaries.minXVal);
        const maxX = parseNumber(widgetStore?.maxX, widgetStore?.linePlotInitXYBoundaries.maxXVal);
        if (minX === undefined || maxX === undefined) {
            return;
        }
        if (isFinite(val) && val !== minX && val < maxX) {
            widgetStore?.setXBounds(val, maxX);
        } else {
            ev.currentTarget.value = minX.toString();
        }
    };

    handleXMaxChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.key !== "Enter") {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        const minX = parseNumber(widgetStore?.minX, widgetStore?.linePlotInitXYBoundaries.minXVal);
        const maxX = parseNumber(widgetStore?.maxX, widgetStore?.linePlotInitXYBoundaries.maxXVal);
        if (minX === undefined || maxX === undefined) {
            return;
        }
        if (isFinite(val) && val !== maxX && val > minX) {
            widgetStore?.setXBounds(minX, val);
        } else {
            ev.currentTarget.value = maxX.toString();
        }
    };

    handleYMinChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.key !== "Enter") {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        const minY = parseNumber(widgetStore?.minY, widgetStore?.linePlotInitXYBoundaries.minYVal);
        const maxY = parseNumber(widgetStore?.maxY, widgetStore?.linePlotInitXYBoundaries.maxYVal);
        if (minY === undefined || maxY === undefined) {
            return;
        }
        if (isFinite(val) && val !== minY && val < maxY) {
            widgetStore?.setYBounds(val, maxY);
        } else {
            ev.currentTarget.value = minY.toString();
        }
    };

    handleYMaxChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.key !== "Enter") {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        const minY = parseNumber(widgetStore?.minY, widgetStore?.linePlotInitXYBoundaries.minYVal);
        const maxY = parseNumber(widgetStore?.maxY, widgetStore?.linePlotInitXYBoundaries.maxYVal);
        if (minY === undefined || maxY === undefined) {
            return;
        }
        if (isFinite(val) && val !== maxY && val > minY) {
            widgetStore?.setYBounds(minY, val);
        } else {
            ev.currentTarget.value = maxY.toString();
        }
    };

    handleSelectedTabChanged = (newTabId: string | number) => {
        this.widgetStore?.setSettingsTabId(Number.parseInt(newTabId.toString()));
    };

    render() {
        const widgetStore = this.widgetStore;
        if (!widgetStore) {
            return null;
        }

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
            isMeanRmsVisible: widgetStore.isMeanRmsVisible,
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

        const isMultiProfileActive = widgetStore.profileSelectionStore.activeProfileCategory === MultiProfileCategory.IMAGE;
        const isCoordinateSettingDisabled = widgetStore.effectiveFrame?.isPVImage || !widgetStore.effectiveFrame?.isSpectralChannel;
        const isXAxisRestFrameInputDisabled = isCoordinateSettingDisabled || !widgetStore.isXAxisRestFrameSupported;
        const isYAxisRestFrameInputDisabled = isCoordinateSettingDisabled || !widgetStore.isYAxisRestFrameSupported;
        const isShiftInputDisabled = isCoordinateSettingDisabled || !widgetStore.isRestFrameCorrectionRequested;
        const isRadialVelocityMode = widgetStore.restFrameShiftMode === RestFrameShiftMode.RADIAL_VELOCITY;
        const shiftInputError = this.shiftInputIntent === Intent.DANGER ? `${restFrameShiftValidationMessage(widgetStore.restFrameShiftMode, widgetStore.restFrameVelocityConvention)}. Correction is temporarily using z = 0.` : undefined;
        return (
            <ScrollShadow>
                <div className="spectral-settings">
                    <Tabs id="spectralSettingTabs" selectedTabId={widgetStore.settingsTabId} onChange={this.handleSelectedTabChanged}>
                        <Tab
                            id={SpectralProfilerSettingsTabs.CONVERSION}
                            panelClassName="conversion-tab-panel"
                            title="Conversion"
                            panel={
                                <React.Fragment>
                                    {widgetStore.effectiveFrame && (
                                        <SpectralSettingsComponent
                                            frame={widgetStore.effectiveFrame}
                                            onSpectralCoordinateChange={widgetStore.setSpectralCoordinate}
                                            onSpectralCoordinateChangeSecondary={widgetStore.setSpectralCoordinateSecondary}
                                            onSpectralSystemChange={widgetStore.setSpectralSystem}
                                            secondaryAxisCursorInfoVisible={widgetStore.isSecondaryAxisCursorInfoVisible}
                                            disable={isCoordinateSettingDisabled}
                                        />
                                    )}
                                    <FormGroup label={"Intensity unit"} inline={true}>
                                        <HTMLSelect
                                            value={isMultiProfileActive ? widgetStore.intensityUnit : widgetStore.effectiveFrame?.intensityUnit}
                                            options={widgetStore.isIntensityConvertible ? widgetStore.intensityOptions : widgetStore.effectiveFrame?.headerUnit ? [widgetStore.effectiveFrame.headerUnit] : []}
                                            onChange={ev => (isMultiProfileActive ? widgetStore.setMultiProfileIntensityUnit(ev.currentTarget.value) : widgetStore.effectiveFrame?.setIntensityUnit(ev.currentTarget.value))}
                                            data-testid="spectral-profiler-settings-intensity-unit-dropdown"
                                        />
                                    </FormGroup>
                                    <FormGroup inline={true} label={"Secondary info"}>
                                        <Switch checked={widgetStore.isSecondaryAxisCursorInfoVisible} onChange={event => widgetStore.setSecondaryAxisCursorInfoVisible(event.currentTarget.checked as boolean)} />
                                    </FormGroup>
                                    <FormGroup inline={true} label={"Rest-frame corrections"} className="rest-frame-section" contentClassName="reference-frame-form-content">
                                        <div className="rest-frame-correction-switches">
                                            <Switch
                                                checked={widgetStore.isXAxisRestFrameEnabled}
                                                disabled={isXAxisRestFrameInputDisabled}
                                                label="X-axis"
                                                onChange={event => widgetStore.setXAxisRestFrameEnabled(event.currentTarget.checked)}
                                                data-testid="spectral-profiler-x-axis-rest-frame-toggle"
                                            />
                                            <div className="rest-frame-correction-switch-with-info">
                                                <Switch
                                                    checked={widgetStore.isYAxisRestFrameEnabled}
                                                    disabled={isYAxisRestFrameInputDisabled}
                                                    label="Y-axis"
                                                    onChange={event => widgetStore.setYAxisRestFrameEnabled(event.currentTarget.checked)}
                                                    data-testid="spectral-profiler-y-axis-rest-frame-toggle"
                                                />
                                                <Tooltip
                                                    content={
                                                        <div className="rest-frame-correction-tooltip">
                                                            <div>This applies only to rest-frame scaling of flux-density-valued quantities; it does not include a luminosity-distance correction or conversion to luminosity.</div>
                                                        </div>
                                                    }
                                                    position={Position.TOP}
                                                >
                                                    <span className="rest-frame-correction-info" aria-label="Y-axis rest-frame correction details" tabIndex={0}>
                                                        <Icon icon="info-sign" size={12} />
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    </FormGroup>
                                    {widgetStore.isRestFrameCorrectionRequested && (
                                        <React.Fragment>
                                            <FormGroup inline={true} label={"Shift input"} contentClassName="reference-frame-form-content">
                                                <HTMLSelect
                                                    disabled={isCoordinateSettingDisabled}
                                                    value={widgetStore.restFrameShiftMode}
                                                    options={[
                                                        {value: RestFrameShiftMode.REDSHIFT, label: "Redshift (z)"},
                                                        {value: RestFrameShiftMode.RADIAL_VELOCITY, label: "Radial velocity (km/s)"}
                                                    ]}
                                                    onChange={event => this.onShiftModeChanged(event.currentTarget.value)}
                                                    data-testid="spectral-profiler-shift-mode-dropdown"
                                                />
                                            </FormGroup>
                                            {isRadialVelocityMode && (
                                                <FormGroup inline={true} label="Velocity convention" contentClassName="reference-frame-form-content">
                                                    <HTMLSelect
                                                        disabled={isCoordinateSettingDisabled}
                                                        value={widgetStore.restFrameVelocityConvention}
                                                        options={[
                                                            {value: VelocityConvention.RADIO, label: "Radio"},
                                                            {value: VelocityConvention.OPTICAL, label: "Optical"},
                                                            {value: VelocityConvention.RELATIVISTIC, label: "Relativistic"}
                                                        ]}
                                                        onChange={event => this.onVelocityConventionChanged(event.currentTarget.value)}
                                                        data-testid="spectral-profiler-velocity-convention-dropdown"
                                                    />
                                                </FormGroup>
                                            )}
                                            <FormGroup inline={true} label={isRadialVelocityMode ? "Radial velocity (km/s)" : "Redshift (z)"} contentClassName="reference-frame-form-content" helperText={shiftInputError}>
                                                <SafeNumericInput
                                                    key={`${widgetStore.restFrameShiftMode}-${widgetStore.restFrameVelocityConvention}`}
                                                    disabled={isShiftInputDisabled}
                                                    value={isRadialVelocityMode ? widgetStore.restFrameRadialVelocity : widgetStore.restFrameRedshift}
                                                    intent={isShiftInputDisabled ? Intent.NONE : this.shiftInputIntent}
                                                    buttonPosition="none"
                                                    className="rest-frame-shift-input"
                                                    onValueChange={this.onShiftChanged}
                                                    data-testid={isRadialVelocityMode ? "spectral-profiler-radial-velocity-input" : "spectral-profiler-redshift-input"}
                                                />
                                            </FormGroup>
                                            {isRadialVelocityMode && (
                                                <FormGroup inline={true} label={"Effective redshift (z)"} contentClassName="reference-frame-form-content">
                                                    <span className="effective-redshift" data-testid="spectral-profiler-effective-redshift">
                                                        {widgetStore.effectiveRestFrameRedshift}
                                                    </span>
                                                </FormGroup>
                                            )}
                                        </React.Fragment>
                                    )}
                                </React.Fragment>
                            }
                        />
                        <Tab id={SpectralProfilerSettingsTabs.STYLING} panelClassName="styling-tab-panel" title="Styling" panel={<LinePlotSettingsPanelComponent {...lineSettingsProps} />} />
                        <Tab id={SpectralProfilerSettingsTabs.SMOOTHING} title="Smoothing" panel={<SmoothingSettingsComponent smoothingStore={widgetStore.smoothingStore} disableColorAndLineWidth={widgetStore.profileNum > 1} />} />
                        <Tab id={SpectralProfilerSettingsTabs.MOMENTS} panelClassName="moment-tab-panel" title="Moments" panel={<MomentGeneratorComponent widgetStore={widgetStore} />} />
                        <Tab id={SpectralProfilerSettingsTabs.FITTING} panelClassName="fitting-tab-panel" title="Fitting" panel={<ProfileFittingComponent fittingStore={widgetStore.fittingStore} widgetStore={widgetStore} />} />
                    </Tabs>
                </div>
            </ScrollShadow>
        );
    }
}
