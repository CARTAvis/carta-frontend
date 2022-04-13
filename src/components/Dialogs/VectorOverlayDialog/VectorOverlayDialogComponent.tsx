import * as React from "react";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, Button, Classes, DialogProps, FormGroup, HTMLSelect, Intent, MenuItem, NonIdealState, Radio, RadioGroup, Switch, Tab, Tabs} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {ColorResult} from "react-color";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore, HelpType} from "stores";
import {FrameStore, VectorOverlayConfigStore, VectorOverlayMode} from "stores/Frame";
import {SWATCH_COLORS} from "utilities";
import {ClearableNumericInputComponent, ColormapComponent, ColorPickerComponent, SafeNumericInput} from "components/Shared";
import "./VectorOverlayDialogComponent.scss";

enum VectorOverlayDialogTabs {
    Configuration,
    Styling
}

const DataSourceSelect = Select.ofType<FrameStore>();

@observer
export class VectorOverlayDialogComponent extends React.Component {
    @observable currentTab: VectorOverlayDialogTabs = VectorOverlayDialogTabs.Configuration;
    @observable mode: VectorOverlayMode;
    @observable pixelAveraging: number;
    @observable threshold: number;
    @observable fractionalIntensity: boolean;
    @observable debiasing: boolean;
    @observable qError: number;
    @observable uError: number;

    private static readonly DefaultWidth = 500;
    private static readonly DefaultHeight = 720;

    private cachedFrame: FrameStore;

    componentDidUpdate() {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame !== this.cachedFrame) {
            this.cachedFrame = appStore.activeFrame;
            this.setDefaultVectorOverlayParameters();
        }
    }

    constructor(props: {appStore: AppStore}) {
        super(props);
        makeObservable(this);
        this.setDefaultVectorOverlayParameters();
    }

    @action setDefaultVectorOverlayParameters() {
        const appStore = AppStore.Instance;
        const config = appStore.activeFrame?.vectorOverlayConfig;
        const preferences = appStore.preferenceStore;
        if (config) {
            this.mode = config.mode;
            this.pixelAveraging = config.pixelAveraging;
            this.fractionalIntensity = config.fractionalIntensity;
            this.threshold = config.threshold;
            this.debiasing = config.debiasing;
        } else {
            this.mode = preferences.vectorOverlayMode;
            this.pixelAveraging = preferences.vectorOverlayPixelAveraging;
            this.fractionalIntensity = preferences.vectorOverlayFractionalIntensity;
            this.threshold = 0;
            this.debiasing = false;
        }
    }

    @computed get configChanged(): boolean {
        const config = AppStore.Instance.activeFrame?.vectorOverlayConfig;
        if (config) {
            if (config.mode !== this.mode || config.pixelAveraging !== this.pixelAveraging || config.threshold !== this.threshold || config.debiasing !== this.debiasing || config.fractionalIntensity !== this.fractionalIntensity) {
                return true;
            }
            if (config.debiasing && (config.qError !== this.qError || config.uError !== this.uError)) {
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
            dataSource.vectorOverlayConfig.setVectorOverlayConfiguration(this.mode, this.pixelAveraging, this.threshold, this.debiasing, this.fractionalIntensity);
            dataSource.applyVectorOverlay();
        }
    };

    private handleClearOverlay = () => {
        AppStore.Instance.activeFrame?.clearVectorOverlay();
    };

    @action private handleModeChanged = (ev: React.ChangeEvent<HTMLSelectElement>) => {
        this.mode = ev.currentTarget.value as VectorOverlayMode;
    };

    @action private handlePixelAveragingChanged = (value: number) => {
        this.pixelAveraging = Math.floor(value * 0.5) * 2.0;
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
        this.fractionalIntensity = parseInt(ev.currentTarget.value) === 1;
    };

    @action private handleDebiasingChanged = (ev: React.ChangeEvent<HTMLInputElement>) => {
        this.debiasing = ev.currentTarget.checked;
    };

    private renderIntensityParameters() {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        if (!frame) {
            return null;
        }

        const config = frame.vectorOverlayConfig;
        const intensityMin = isFinite(config.intensityMin) ? config.intensityMin : frame.vectorOverlayStore.intensityMin;
        const intensityMax = isFinite(config.intensityMax) ? config.intensityMax : frame.vectorOverlayStore.intensityMax;

        return (
            <FormGroup label={`Intensity (${frame.unit})`} inline={true}>
                <div className="parameter-container">
                    <div className="parameter-line">
                        <ClearableNumericInputComponent
                            label="Min"
                            value={intensityMin}
                            placeholder="Automatic"
                            onValueChanged={val => config.setIntensityRange(val, config.intensityMax)}
                            onValueCleared={() => config.setIntensityRange(undefined, config.intensityMax)}
                            displayExponential={true}
                        />
                        <ClearableNumericInputComponent
                            label="Max"
                            value={intensityMax}
                            placeholder="Automatic"
                            onValueChanged={val => config.setIntensityRange(config.intensityMin, val)}
                            onValueCleared={() => config.setIntensityRange(config.intensityMin, undefined)}
                            displayExponential={true}
                        />
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
        const angleOnly = frame.vectorOverlayConfig.mode === VectorOverlayMode.AngleOnly;
        const intensityOnly = frame.vectorOverlayConfig.mode === VectorOverlayMode.IntensityOnly;

        return (
            <FormGroup label={intensityOnly ? "Block Width (px)" : "Line Length (px)"} inline={true}>
                <div className="parameter-container">
                    <div className="parameter-line">
                        <ClearableNumericInputComponent
                            disabled={angleOnly}
                            label="Min"
                            value={config.lengthMin}
                            onValueChanged={val => config.setLengthRange(val, config.lengthMax)}
                            onValueCleared={() => config.setLengthRange(VectorOverlayConfigStore.DefaultLengthMin, config.lengthMax)}
                        />
                        <ClearableNumericInputComponent
                            label="Max"
                            value={config.lengthMax}
                            onValueChanged={val => config.setLengthRange(config.lengthMin, val)}
                            onValueCleared={() => config.setLengthRange(config.lengthMin, VectorOverlayConfigStore.DefaultLengthMax)}
                        />
                    </div>
                </div>
            </FormGroup>
        );
    }

    public render() {
        const appStore = AppStore.Instance;

        const dialogProps: DialogProps = {
            // TODO: custom icon
            icon: "slash",
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.vectorOverlayDialogVisible,
            onClose: appStore.dialogStore.hideVectorOverlayDialog,
            className: "vector-overlay-dialog",
            canEscapeKeyClose: true,
            title: "Vector Overlay Configuration"
        };

        if (!appStore?.activeFrame) {
            return (
                <DraggableDialogComponent
                    dialogProps={dialogProps}
                    helpType={HelpType.VECTOR_OVERLAY}
                    defaultWidth={VectorOverlayDialogComponent.DefaultWidth}
                    defaultHeight={VectorOverlayDialogComponent.DefaultHeight}
                    enableResizing={true}
                >
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                </DraggableDialogComponent>
            );
        }

        const dataSource = appStore.activeFrame;
        const intensityOnly = dataSource.vectorOverlayConfig.mode === VectorOverlayMode.IntensityOnly;

        const configPanel = (
            <div className="vector-overlay-config-panel">
                <FormGroup inline={true} label="Mode">
                    <HTMLSelect value={this.mode} onChange={this.handleModeChanged}>
                        <option value={VectorOverlayMode.IntensityAndAngle}>Intensity and Angle</option>
                        <option value={VectorOverlayMode.AngleOnly}>Angle Only (Lines)</option>
                        <option value={VectorOverlayMode.IntensityOnly}>Intensity Only (Blocks)</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Pixel Averaging">
                    <SafeNumericInput placeholder="Pixel Averaging" min={2} max={64} value={this.pixelAveraging} majorStepSize={2} stepSize={2} onValueChange={this.handlePixelAveragingChanged} />
                </FormGroup>
                <FormGroup inline={true} label="Polarization Intensity">
                    <RadioGroup inline={true} onChange={this.handleFractionalIntensityChanged} selectedValue={this.fractionalIntensity ? 1 : 0}>
                        <Radio label={"Absolute"} value={0} />
                        <Radio label={"Fractional"} value={1} />
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label={`Threshold (${this.fractionalIntensity ? "%" : dataSource.unit})`}>
                    <SafeNumericInput placeholder="Threshold" min={this.fractionalIntensity ? 0 : undefined} max={this.fractionalIntensity ? 100 : undefined} value={this.threshold} onValueChange={this.handleThresholdChanged} />
                </FormGroup>
                <FormGroup inline={true} label="Debiasing">
                    <Switch checked={this.debiasing} onChange={this.handleDebiasingChanged} />
                </FormGroup>
                <FormGroup disabled={!this.debiasing} inline={true} label="Stokes Q Error">
                    <SafeNumericInput disabled={!this.debiasing} placeholder="Value" value={this.qError} onValueChange={this.handleQErrorChanged} />
                </FormGroup>
                <FormGroup disabled={!this.debiasing} inline={true} label="Stokes U Error">
                    <SafeNumericInput disabled={!this.debiasing} placeholder="Value" value={this.uError} onValueChange={this.handleUErrorChanged} />
                </FormGroup>
            </div>
        );

        const stylingPanel = (
            <div className="vector-overlay-style-panel">
                <FormGroup disabled={intensityOnly} inline={true} label="Line Thickness (px)">
                    <SafeNumericInput
                        disabled={intensityOnly}
                        placeholder="Thickness"
                        min={0.5}
                        max={10}
                        value={dataSource.vectorOverlayConfig.thickness}
                        majorStepSize={0.5}
                        stepSize={0.5}
                        onValueChange={dataSource.vectorOverlayConfig.setThickness}
                    />
                </FormGroup>
                {this.renderIntensityParameters()}
                {this.renderLengthParameters()}
                <FormGroup inline={true} label="Color Mode">
                    <HTMLSelect value={dataSource.vectorOverlayConfig.colormapEnabled ? 1 : 0} onChange={ev => dataSource.vectorOverlayConfig.setColormapEnabled(parseInt(ev.currentTarget.value) > 0)}>
                        <option key={0} value={0}>
                            Constant Color
                        </option>
                        <option key={1} value={1}>
                            Color-mapped
                        </option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Color Map" disabled={!dataSource.vectorOverlayConfig.colormapEnabled}>
                    <ColormapComponent inverted={false} disabled={!dataSource.vectorOverlayConfig.colormapEnabled} selectedItem={dataSource.vectorOverlayConfig.colormap} onItemSelect={dataSource.vectorOverlayConfig.setColormap} />
                </FormGroup>
                <FormGroup inline={true} label="Bias" disabled={!dataSource.vectorOverlayConfig.colormapEnabled}>
                    <SafeNumericInput
                        disabled={!dataSource.vectorOverlayConfig.colormapEnabled}
                        placeholder="Bias"
                        min={-1.0}
                        max={1.0}
                        value={dataSource.vectorOverlayConfig.colormapBias}
                        majorStepSize={0.1}
                        stepSize={0.1}
                        onValueChange={dataSource.vectorOverlayConfig.setColormapBias}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Contrast" disabled={!dataSource.vectorOverlayConfig.colormapEnabled}>
                    <SafeNumericInput
                        disabled={!dataSource.vectorOverlayConfig.colormapEnabled}
                        placeholder="Contrast"
                        min={0.0}
                        max={3.0}
                        value={dataSource.vectorOverlayConfig.colormapContrast}
                        majorStepSize={0.1}
                        stepSize={0.1}
                        onValueChange={dataSource.vectorOverlayConfig.setColormapContrast}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Color" disabled={dataSource.vectorOverlayConfig.colormapEnabled}>
                    <ColorPickerComponent
                        color={dataSource.vectorOverlayConfig.color}
                        presetColors={SWATCH_COLORS}
                        setColor={(color: ColorResult) => dataSource.vectorOverlayConfig.setColor(color.rgb)}
                        disableAlpha={true}
                        disabled={dataSource.vectorOverlayConfig.colormapEnabled}
                        darkTheme={appStore.darkTheme}
                    />
                </FormGroup>
            </div>
        );

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.VECTOR_OVERLAY} defaultWidth={VectorOverlayDialogComponent.DefaultWidth} defaultHeight={VectorOverlayDialogComponent.DefaultHeight} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <FormGroup inline={true} label="Data Source">
                        <DataSourceSelect
                            activeItem={dataSource}
                            onItemSelect={appStore.setActiveFrame}
                            popoverProps={{minimal: true, position: "bottom"}}
                            filterable={false}
                            items={appStore.frames}
                            itemRenderer={this.renderDataSourceSelectItem}
                            disabled={appStore.animatorStore.animationActive}
                        >
                            <Button text={dataSource.filename} rightIcon="double-caret-vertical" alignText={"right"} disabled={appStore.animatorStore.animationActive} />
                        </DataSourceSelect>
                    </FormGroup>
                    <Tabs defaultSelectedTabId={VectorOverlayDialogTabs.Configuration} renderActiveTabPanelOnly={false}>
                        <Tab id={VectorOverlayDialogTabs.Configuration} title="Configuration" panel={configPanel} panelClassName="vector-overlay-config-panel" />
                        <Tab id={VectorOverlayDialogTabs.Styling} title="Styling" panel={stylingPanel} panelClassName="vector-overlay-styling-panel" />
                    </Tabs>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.WARNING} onClick={this.handleClearOverlay} disabled={!dataSource.vectorOverlayConfig.enabled} text="Clear" />
                        <AnchorButton intent={Intent.SUCCESS} onClick={this.handleApplyOverlay} disabled={!this.configChanged && dataSource.vectorOverlayConfig.enabled} text="Apply" />
                        <AnchorButton intent={Intent.NONE} onClick={appStore.dialogStore.hideVectorOverlayDialog} text="Close" />
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
