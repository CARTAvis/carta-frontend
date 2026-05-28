import * as React from "react";
import {type ColorResult} from "react-color";
import {AnchorButton, Button, Classes, type DialogProps, FormGroup, HTMLSelect, Intent, MenuItem, NonIdealState, Radio, RadioGroup, Switch, Tab, Tabs} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {ClearableNumericInputComponent, ColormapComponent, ColorPickerComponent, SafeNumericInput, ScrollShadow} from "components/Shared";
import {DialogId, HelpType, Polarizations, VectorOverlayDialogTabs, VectorOverlaySource} from "enums";
import {CustomIcon} from "icons/CustomIcons";
import {AppStore} from "stores";
import {type FrameStore} from "stores/Frame";
import {SWATCH_COLORS} from "utilities";

import "./VectorOverlayDialogComponent.scss";

// eslint-disable-next-line @typescript-eslint/naming-convention
const DataSourceSelect = Select<FrameStore>;

@observer
export class VectorOverlayDialogComponent extends React.Component {
    @observable currentTab: VectorOverlayDialogTabs = VectorOverlayDialogTabs.Configuration;
    @observable angularSource: VectorOverlaySource = VectorOverlaySource.Current;
    @observable intensitySource: VectorOverlaySource = VectorOverlaySource.Current;
    /**
     * Pixel width for boxcar averaging the vector overlay. Must be an integer. 1 means no averaging.
     */
    @observable pixelAveraging: number = 1;
    @observable isThresholdEnabled: boolean = false;
    @observable threshold: number = 0;
    @observable isFractionalIntensity: boolean = false;
    @observable isDebiasing: boolean = false;
    @observable qError: number = 0;
    @observable uError: number = 0;
    @observable thresholdOption: CARTA.PolarizationType.I | CARTA.PolarizationType.Plinear;

    private static readonly DefaultWidth = 500;
    private static readonly DefaultHeight = 720;
    private static readonly MinWidth = 425;
    private static readonly MinHeight = 400;
    /**
     * The maximum pixel width for averaging the vector overlay.
     */
    public static readonly MAX_PIXEL_AVERAGING = 64;

    private cachedFrame: FrameStore | null = null;

    componentDidUpdate() {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame !== this.cachedFrame) {
            this.cachedFrame = appStore.activeFrame;
            this.setDefaultVectorOverlayParameters();
        }
    }

    constructor(props: {appStore: AppStore}) {
        super(props);
        this.setDefaultVectorOverlayParameters();
        makeObservable(this);
    }

    @action setDefaultVectorOverlayParameters = () => {
        const appStore = AppStore.Instance;
        const config = appStore.activeFrame?.vectorOverlayConfig;
        const preferences = appStore.preferenceStore;
        if (config) {
            this.angularSource = config.angularSource;
            this.intensitySource = config.intensitySource;
            this.pixelAveraging = config.pixelAveraging;
            this.isFractionalIntensity = config.isFractionalIntensity;
            this.threshold = config.threshold;
            this.isThresholdEnabled = config.isThresholdEnabled;
            this.isDebiasing = config.isDebiasing;
            this.thresholdOption = config.thresholdOption;
        } else {
            this.angularSource = VectorOverlaySource.Current;
            this.intensitySource = VectorOverlaySource.Current;
            this.pixelAveraging = preferences.vectorOverlayPixelAveraging;
            this.isFractionalIntensity = preferences.isVectorOverlayFractionalIntensity;
            this.isThresholdEnabled = false;
            this.threshold = 0;
            this.isDebiasing = false;
            this.thresholdOption = CARTA.PolarizationType.Plinear;
        }
    };

    @computed get hasConfigChanged(): boolean {
        const config = AppStore.Instance.activeFrame?.vectorOverlayConfig;
        if (config) {
            if (
                config.angularSource !== this.angularSource ||
                config.intensitySource !== this.intensitySource ||
                config.pixelAveraging !== this.pixelAveraging ||
                config.isThresholdEnabled !== this.isThresholdEnabled ||
                config.isDebiasing !== this.isDebiasing ||
                config.isFractionalIntensity !== this.isFractionalIntensity
            ) {
                return true;
            }
            if (config.isDebiasing && (config.qError !== this.qError || config.uError !== this.uError)) {
                return true;
            }

            if (config.isThresholdEnabled && (config.threshold !== this.threshold || config.thresholdOption !== this.thresholdOption)) {
                return true;
            }
        }
        return false;
    }

    private renderDataSourceSelectItem = (frame: FrameStore, {handleClick, modifiers, query}) => {
        if (!frame) {
            return null;
        }
        return <MenuItem text={frame.filename} onClick={handleClick} key={frame.frameInfo.fileId} />;
    };

    private handleApplyOverlay = () => {
        const dataSource = AppStore.Instance.activeFrame;
        if (dataSource) {
            dataSource.vectorOverlayConfig.setVectorOverlayConfiguration(
                this.angularSource,
                this.intensitySource,
                this.pixelAveraging,
                this.isFractionalIntensity,
                this.isThresholdEnabled,
                this.threshold,
                this.isDebiasing,
                this.qError,
                this.uError,
                this.thresholdOption
            );
            dataSource.applyVectorOverlay();
        }
    };

    private handleClearOverlay = () => {
        AppStore.Instance.activeFrame?.clearVectorOverlay();
    };

    @action private handleAngularSourceChanged = (ev: React.ChangeEvent<HTMLSelectElement>) => {
        this.angularSource = parseInt(ev.currentTarget.value) as VectorOverlaySource;
    };

    @action private handleIntensitySourceChanged = (ev: React.ChangeEvent<HTMLSelectElement>) => {
        this.intensitySource = parseInt(ev.currentTarget.value) as VectorOverlaySource;
    };

    @action private handlePixelAveragingChanged = (value: number) => {
        this.pixelAveraging = Math.round(value);
    };

    @action private handlePixelAveragingBlurred = (ev: React.FocusEvent<HTMLInputElement>) => {
        ev.currentTarget.value = this.pixelAveraging.toString();
    };

    @action private handleThresholdEnabledChanged = (ev: React.ChangeEvent<HTMLInputElement>) => {
        this.isThresholdEnabled = ev.currentTarget.checked;
    };

    @action private handleThresholdChanged = (value: number) => {
        this.threshold = value;
    };

    @action private handleQErrorChanged = (value: number) => {
        this.qError = value;
    };

    @action private handleUErrorChanged = (value: number) => {
        this.uError = value;
    };

    @action private handleFractionalIntensityChanged = (ev: React.ChangeEvent<HTMLInputElement>) => {
        this.isFractionalIntensity = parseInt(ev.currentTarget.value) === 1;
    };

    @action private handleDebiasingChanged = (ev: React.ChangeEvent<HTMLInputElement>) => {
        this.isDebiasing = ev.currentTarget.checked;
    };

    @action private handleThresholdOptionChanged = (ev: React.ChangeEvent<HTMLSelectElement>) => {
        this.thresholdOption = parseInt(ev.currentTarget.value);
    };

    private renderIntensityParameters() {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        if (!frame) {
            return null;
        }

        const config = frame.vectorOverlayConfig;
        const intensityMin = config.intensityMin !== undefined && isFinite(config.intensityMin) ? config.intensityMin : frame.vectorOverlayStore.intensityMin;
        const intensityMax = config.intensityMax !== undefined && isFinite(config.intensityMax) ? config.intensityMax : frame.vectorOverlayStore.intensityMax;

        return (
            <FormGroup label="Intensity" labelInfo={config.isFractionalIntensity ? "(%)" : frame.headerUnit ? `(${frame.headerUnit})` : ""} inline={true}>
                <div className="parameter-container">
                    <div className="parameter-line parameter-intensity">
                        {intensityMin !== undefined ? (
                            <ClearableNumericInputComponent
                                label="Min"
                                value={intensityMin}
                                placeholder="Automatic"
                                onValueChanged={val => config.setIntensityRange(val, config.intensityMax)}
                                onValueCleared={() => config.setIntensityRange(undefined, config.intensityMax)}
                                displayExponential={true}
                            />
                        ) : (
                            <ClearableNumericInputComponent
                                label="Min"
                                value={0}
                                placeholder="Automatic"
                                onValueChanged={val => config.setIntensityRange(val, config.intensityMax)}
                                onValueCleared={() => config.setIntensityRange(undefined, config.intensityMax)}
                                displayExponential={true}
                            />
                        )}
                        {intensityMax !== undefined ? (
                            <ClearableNumericInputComponent
                                label="Max"
                                value={intensityMax}
                                placeholder="Automatic"
                                onValueChanged={val => config.setIntensityRange(config.intensityMin, val)}
                                onValueCleared={() => config.setIntensityRange(config.intensityMin, undefined)}
                                displayExponential={true}
                            />
                        ) : (
                            <ClearableNumericInputComponent
                                label="Max"
                                value={1}
                                placeholder="Automatic"
                                onValueChanged={val => config.setIntensityRange(config.intensityMin, val)}
                                onValueCleared={() => config.setIntensityRange(config.intensityMin, undefined)}
                                displayExponential={true}
                            />
                        )}
                    </div>
                </div>
            </FormGroup>
        );
    }

    private renderLengthParameters() {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        if (!frame) {
            return null;
        }

        const config = frame.vectorOverlayConfig;
        const isAngleOnly = frame.vectorOverlayConfig.intensitySource === VectorOverlaySource.None;
        const isIntensityOnly = frame.vectorOverlayConfig.angularSource === VectorOverlaySource.None;

        return (
            <FormGroup label={isIntensityOnly ? "Block width" : "Line length"} labelInfo="(px)" inline={true}>
                <div className="parameter-container">
                    <div className="parameter-line parameter-length">
                        <FormGroup inline={true} label="Min">
                            <SafeNumericInput min={0} max={config.lengthMax} disabled={isAngleOnly} value={config.lengthMin} onValueChange={val => config.setLengthRange(val, config.lengthMax)} />
                        </FormGroup>
                        <FormGroup inline={true} label="Max">
                            <SafeNumericInput min={config.lengthMin} value={config.lengthMax} onValueChange={val => config.setLengthRange(config.lengthMin, val)} data-testid="vector-field-line-length-max-input" />
                        </FormGroup>
                    </div>
                </div>
            </FormGroup>
        );
    }

    public render() {
        const appStore = AppStore.Instance;
        const className = classNames("vector-overlay-dialog", {[Classes.DARK]: appStore.isDarkTheme});

        const dialogProps: DialogProps = {
            icon: <CustomIcon icon="vectorOverlay" size={CustomIcon.SIZE_LARGE} />,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.dialogVisible.get(DialogId.Vector) ?? false,
            className: className,
            canEscapeKeyClose: true,
            title: "Vector Overlay Configuration"
        };

        if (!appStore?.activeFrame) {
            return (
                <DraggableDialogComponent
                    dialogProps={dialogProps}
                    helpType={HelpType.VECTOR_OVERLAY}
                    minWidth={VectorOverlayDialogComponent.MinWidth}
                    minHeight={VectorOverlayDialogComponent.MinHeight}
                    defaultWidth={VectorOverlayDialogComponent.DefaultWidth}
                    defaultHeight={VectorOverlayDialogComponent.DefaultHeight}
                    isResizingEnabled={true}
                    dialogId={DialogId.Vector}
                >
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                </DraggableDialogComponent>
            );
        }

        const dataSource = appStore.activeFrame;
        const isIntensityOnly = dataSource.vectorOverlayConfig.angularSource === VectorOverlaySource.None;
        const isAngleOnly = dataSource.vectorOverlayConfig.intensitySource === VectorOverlaySource.None;

        const isComputedPIOptionAvailable = dataSource.hasLinearStokes;
        const isStokesIOptionAvailable = dataSource.polarizations.includes(Polarizations.I);
        const isThresholdOptionDisabled = !(isComputedPIOptionAvailable && isStokesIOptionAvailable);
        const numberOfAvailableOptions = (isComputedPIOptionAvailable ? 1 : 0) + (isStokesIOptionAvailable ? 1 : 0);

        const configPanel = (
            <div className="vector-overlay-config-panel">
                <FormGroup inline={true} label="Angular source">
                    <HTMLSelect value={this.angularSource} onChange={this.handleAngularSourceChanged} data-testid="vector-field-angular-source-dropdown">
                        <option value={VectorOverlaySource.None} data-testid="vector-field-angular-source-dropdown-none">
                            None
                        </option>
                        <option value={VectorOverlaySource.Current}>Current image</option>
                        {isComputedPIOptionAvailable && <option value={VectorOverlaySource.Computed}>Computed PA</option>}
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Intensity source">
                    <HTMLSelect value={this.intensitySource} onChange={this.handleIntensitySourceChanged} data-testid="vector-field-intensity-source-dropdown">
                        <option value={VectorOverlaySource.None} data-testid="vector-field-intensity-source-dropdown-none">
                            None
                        </option>
                        <option value={VectorOverlaySource.Current}>Current image</option>
                        {isComputedPIOptionAvailable && (
                            <option value={VectorOverlaySource.Computed} data-testid="vector-field-intensity-source-dropdown-computed-pi">
                                Computed PI
                            </option>
                        )}
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Averaging width" labelInfo="(px)" className="averaging-width-input">
                    <SafeNumericInput
                        min={1}
                        max={VectorOverlayDialogComponent.MAX_PIXEL_AVERAGING}
                        value={this.pixelAveraging}
                        stepSize={1}
                        majorStepSize={2}
                        minorStepSize={1}
                        onValueChange={this.handlePixelAveragingChanged}
                        onBlur={this.handlePixelAveragingBlurred}
                        data-testid="vector-field-averaging-width-input"
                    />
                </FormGroup>
                <FormGroup inline={true} label="Polarization intensity" disabled={this.intensitySource === VectorOverlaySource.None}>
                    <RadioGroup inline={true} onChange={this.handleFractionalIntensityChanged} selectedValue={this.isFractionalIntensity ? 1 : 0} disabled={this.intensitySource === VectorOverlaySource.None}>
                        <Radio label={"Absolute"} value={0} />
                        <Radio label={"Fractional"} value={1} />
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label="Threshold enabled">
                    <Switch checked={this.isThresholdEnabled} onChange={this.handleThresholdEnabledChanged} data-testid="vector-field-threshold-toggle" />
                    {this.isThresholdEnabled && numberOfAvailableOptions > 0 && (
                        <HTMLSelect value={this.thresholdOption} onChange={ev => this.handleThresholdOptionChanged(ev)} data-testid="vector-field-threshold-option-dropdown" disabled={isThresholdOptionDisabled}>
                            {isComputedPIOptionAvailable && <option value={CARTA.PolarizationType.Plinear}>Computed PI</option>}
                            {isStokesIOptionAvailable && <option value={CARTA.PolarizationType.I}>Stokes I</option>}
                        </HTMLSelect>
                    )}
                </FormGroup>
                <FormGroup disabled={!this.isThresholdEnabled} inline={true} label="Threshold" labelInfo={dataSource.headerUnit ? `(${dataSource.headerUnit})` : ""}>
                    <SafeNumericInput disabled={!this.isThresholdEnabled} placeholder="Threshold" buttonPosition="none" value={this.threshold} onValueChange={this.handleThresholdChanged} data-testid="vector-field-threshold-input" />
                </FormGroup>
                <FormGroup inline={true} label="Debiasing">
                    <Switch checked={this.isDebiasing} onChange={this.handleDebiasingChanged} data-testid="vector-field-debiasing-toggle" />
                </FormGroup>
                <FormGroup disabled={!this.isDebiasing} inline={true} label="Stokes Q error">
                    <SafeNumericInput disabled={!this.isDebiasing} buttonPosition="none" placeholder="Value" value={this.qError} onValueChange={this.handleQErrorChanged} data-testid="vector-field-stokes-q-error-input" />
                </FormGroup>
                <FormGroup disabled={!this.isDebiasing} inline={true} label="Stokes U error">
                    <SafeNumericInput disabled={!this.isDebiasing} buttonPosition="none" placeholder="Value" value={this.uError} onValueChange={this.handleUErrorChanged} data-testid="vector-field-stokes-u-error-input" />
                </FormGroup>
            </div>
        );

        const stylingPanel = (
            <div className="vector-overlay-style-panel">
                <FormGroup disabled={isIntensityOnly} inline={true} label="Line thickness" labelInfo="(px)">
                    <SafeNumericInput
                        disabled={isIntensityOnly}
                        placeholder="Thickness"
                        min={0.5}
                        max={10}
                        value={dataSource.vectorOverlayConfig.thickness}
                        majorStepSize={0.5}
                        stepSize={0.5}
                        onValueChange={dataSource.vectorOverlayConfig.setThickness}
                        data-testid="vector-field-line-input"
                    />
                </FormGroup>
                {!isAngleOnly && this.renderIntensityParameters()}
                {this.renderLengthParameters()}
                <ClearableNumericInputComponent
                    label="Rotation offset"
                    labelInfo="(deg)"
                    value={dataSource.vectorOverlayConfig.rotationOffset}
                    onValueChanged={dataSource.vectorOverlayConfig.setRotationOffset}
                    onValueCleared={() => dataSource.vectorOverlayConfig.setRotationOffset(0)}
                    data-testid="vector-field-rotation-offset-input"
                />
                <FormGroup inline={true} label="Color mode">
                    <HTMLSelect
                        value={dataSource.vectorOverlayConfig.isColormapEnabled ? 1 : 0}
                        onChange={ev => dataSource.vectorOverlayConfig.setColormapEnabled(parseInt(ev.currentTarget.value) > 0)}
                        data-testid="vector-field-color-mode-dropdown"
                    >
                        <option key={0} value={0}>
                            Constant color
                        </option>
                        <option key={1} value={1} data-testid="vector-field-color-mode-dropdown-colormapped">
                            Color-mapped
                        </option>
                    </HTMLSelect>
                </FormGroup>
                {dataSource.vectorOverlayConfig.isColormapEnabled ? (
                    <React.Fragment>
                        <FormGroup inline={true} label="Colormap">
                            <ColormapComponent inverted={false} selectedColormap={dataSource.vectorOverlayConfig.colormap} onColormapSelect={dataSource.vectorOverlayConfig.setColormap} />
                        </FormGroup>
                        <FormGroup inline={true} label="Bias">
                            <SafeNumericInput placeholder="Bias" min={-1.0} max={1.0} value={dataSource.vectorOverlayConfig.colormapBias} majorStepSize={0.1} stepSize={0.1} onValueChange={dataSource.vectorOverlayConfig.setColormapBias} />
                        </FormGroup>
                        <FormGroup inline={true} label="Contrast">
                            <SafeNumericInput
                                placeholder="Contrast"
                                min={0.0}
                                max={3.0}
                                value={dataSource.vectorOverlayConfig.colormapContrast}
                                majorStepSize={0.1}
                                stepSize={0.1}
                                onValueChange={dataSource.vectorOverlayConfig.setColormapContrast}
                            />
                        </FormGroup>
                    </React.Fragment>
                ) : (
                    <FormGroup inline={true} label="Color">
                        <ColorPickerComponent
                            color={dataSource.vectorOverlayConfig.color}
                            presetColors={SWATCH_COLORS}
                            setColor={(color: ColorResult) => dataSource.vectorOverlayConfig.setColor(color.rgb)}
                            disableAlpha={true}
                            darkTheme={appStore.isDarkTheme}
                        />
                    </FormGroup>
                )}
            </div>
        );

        return (
            <DraggableDialogComponent
                dialogProps={dialogProps}
                helpType={HelpType.VECTOR_OVERLAY}
                defaultWidth={VectorOverlayDialogComponent.DefaultWidth}
                defaultHeight={VectorOverlayDialogComponent.DefaultHeight}
                minWidth={VectorOverlayDialogComponent.MinWidth}
                minHeight={VectorOverlayDialogComponent.MinHeight}
                isResizingEnabled={true}
                dialogId={DialogId.Vector}
            >
                <div className={Classes.DIALOG_BODY}>
                    <ScrollShadow>
                        <FormGroup inline={true} label="Data source">
                            <DataSourceSelect
                                activeItem={dataSource}
                                onItemSelect={appStore.updateActiveImageByFrame}
                                popoverProps={{minimal: true, position: "bottom"}}
                                filterable={false}
                                items={appStore.frames}
                                itemRenderer={this.renderDataSourceSelectItem}
                                disabled={appStore.animatorStore.isAnimationActive}
                                fill={true}
                            >
                                <Button text={dataSource.filename} rightIcon="double-caret-vertical" alignText={"right"} disabled={appStore.animatorStore.isAnimationActive} />
                            </DataSourceSelect>
                        </FormGroup>
                        <Tabs defaultSelectedTabId={VectorOverlayDialogTabs.Configuration} renderActiveTabPanelOnly={false}>
                            <Tab id={VectorOverlayDialogTabs.Configuration} title="Configuration" panel={configPanel} panelClassName="vector-overlay-config-panel" data-testid="vector-field-configuration-tab" />
                            <Tab id={VectorOverlayDialogTabs.Styling} title="Styling" panel={stylingPanel} panelClassName="vector-overlay-styling-panel" data-testid="vector-field-styling-tab" />
                        </Tabs>
                    </ScrollShadow>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.WARNING} onClick={this.handleClearOverlay} disabled={!dataSource.vectorOverlayConfig.isEnabled} text="Clear" data-testid="vector-field-clear-button" />
                        <AnchorButton
                            intent={Intent.SUCCESS}
                            onClick={this.handleApplyOverlay}
                            disabled={(this.angularSource === VectorOverlaySource.None && this.intensitySource === VectorOverlaySource.None) || (!this.hasConfigChanged && dataSource.vectorOverlayConfig.isEnabled)}
                            text="Apply"
                            data-testid="vector-field-apply-button"
                        />
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
