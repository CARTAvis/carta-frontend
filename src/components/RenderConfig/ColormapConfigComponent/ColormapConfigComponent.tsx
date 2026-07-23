import * as React from "react";
import {type ColorResult} from "react-color";
import {Button, Collapse, FormGroup, Switch} from "@blueprintjs/core";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import tinycolor from "tinycolor2";

import {BiasContrastSelectComponent, ColormapComponent, ColorPickerComponent, ScalingParameterControlComponent, ScalingSelectComponent} from "components/Shared";
import {FrameScaling, PreferenceKeys} from "enums";
import {AppStore} from "stores";
import {RenderConfigStore} from "stores/Frame";
import {getScalingParameterConfig, SWATCH_COLORS} from "utilities";

interface ColormapConfigProps {
    renderConfig: RenderConfigStore;
}

interface ScalingPreviewSession {
    renderConfig: RenderConfigStore;
    baseScaling: FrameScaling;
}

interface ColormapPreviewSession {
    renderConfig: RenderConfigStore;
    baseColormap: string;
}

@observer
export class ColormapConfigComponent extends React.Component<ColormapConfigProps> {
    @observable isExtendBiasContrast: boolean = false;
    @observable.ref private scalingPreviewSession: ScalingPreviewSession | null = null;
    @observable.ref private colormapPreviewSession: ColormapPreviewSession | null = null;

    @action switchExtendBiasContrast = () => {
        this.isExtendBiasContrast = !this.isExtendBiasContrast;
    };

    constructor(props) {
        super(props);
        makeObservable(this);
    }

    handleInvertedChanged: React.FormEventHandler<HTMLInputElement> = evt => {
        this.props.renderConfig.setInverted(evt.currentTarget.checked);
    };

    private renderScalingParameter(renderConfig: RenderConfigStore): React.ReactNode {
        const previewSession = this.scalingPreviewSession?.renderConfig === renderConfig ? this.scalingPreviewSession : null;
        const currentScaling = renderConfig.scaling;
        const currentParameterConfig = getScalingParameterConfig(currentScaling);
        if (!previewSession && !currentParameterConfig) {
            return null;
        }

        const baseParameterConfig = previewSession ? getScalingParameterConfig(previewSession.baseScaling) : undefined;
        if (previewSession && !baseParameterConfig) {
            return null;
        }

        const isPlaceholder = !currentParameterConfig;
        const scaling = isPlaceholder ? previewSession!.baseScaling : currentScaling;
        const parameterConfig = currentParameterConfig ?? baseParameterConfig!;
        const isGamma = scaling === FrameScaling.GAMMA;
        return (
            <FormGroup className={isPlaceholder ? "scaling-parameter-placeholder" : undefined} label={isGamma ? "Gamma" : "Alpha"} inline={true} aria-hidden={isPlaceholder || undefined}>
                <ScalingParameterControlComponent
                    scaling={scaling}
                    min={parameterConfig.min}
                    max={parameterConfig.max}
                    value={renderConfig.getScalingParameter(scaling)}
                    onValueChange={value => renderConfig.setScalingParameter(scaling, value)}
                />
            </FormGroup>
        );
    }

    @action private revertScalingPreview = () => {
        const session = this.scalingPreviewSession;
        this.scalingPreviewSession = null;

        if (session && session.renderConfig.scaling !== session.baseScaling) {
            session.renderConfig.setScaling(session.baseScaling);
        }
    };

    @action private handleScalingHovered = (scaling: FrameScaling) => {
        const renderConfig = this.props.renderConfig;
        if (this.scalingPreviewSession?.renderConfig !== renderConfig) {
            this.revertScalingPreview();
            this.scalingPreviewSession = {renderConfig, baseScaling: renderConfig.scaling};
        }
        if (renderConfig.scaling !== scaling) {
            renderConfig.setScaling(scaling);
        }
    };

    @action private handleScalingSelected = (scaling: FrameScaling) => {
        this.scalingPreviewSession = null;
        this.props.renderConfig.setScaling(scaling);
    };

    private handleScalingDropdownOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            this.revertScalingPreview();
        }
    };

    @action private revertColormapPreview = () => {
        const session = this.colormapPreviewSession;
        this.colormapPreviewSession = null;

        if (session && session.renderConfig.colorMap !== session.baseColormap) {
            session.renderConfig.setColorMap(session.baseColormap);
        }
    };

    @action private handleColormapHovered = (colormap: string) => {
        const renderConfig = this.props.renderConfig;
        if (this.colormapPreviewSession?.renderConfig !== renderConfig) {
            this.revertColormapPreview();
            this.colormapPreviewSession = {renderConfig, baseColormap: renderConfig.colorMap};
        }
        if (renderConfig.colorMap !== colormap) {
            renderConfig.setColorMap(colormap);
        }
    };

    @action private handleColormapSelected = (colormap: string) => {
        this.colormapPreviewSession = null;
        this.props.renderConfig.setColorMap(colormap);
    };

    private handleColormapDropdownOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            this.revertColormapPreview();
        }
    };

    componentDidUpdate(prevProps: ColormapConfigProps): void {
        if (prevProps.renderConfig !== this.props.renderConfig) {
            this.revertScalingPreview();
            this.revertColormapPreview();
        }
    }

    componentWillUnmount(): void {
        this.revertScalingPreview();
        this.revertColormapPreview();
    }

    render() {
        if (!this.props.renderConfig) {
            return null;
        }

        const appStore = AppStore.Instance;
        const preference = appStore.preferenceStore;

        const renderConfig = this.props.renderConfig;
        return (
            <React.Fragment>
                <FormGroup label={"Scaling"} inline={true}>
                    <ScalingSelectComponent selectedItem={renderConfig.scaling} onItemSelect={this.handleScalingSelected} onItemHover={this.handleScalingHovered} onDropdownOpenChange={this.handleScalingDropdownOpenChange} />
                </FormGroup>
                <FormGroup label={"Colormap"} inline={true}>
                    <ColormapComponent
                        inverted={renderConfig.isInverted}
                        selectedColormap={renderConfig.colorMap}
                        onColormapSelect={this.handleColormapSelected}
                        onColormapHover={this.handleColormapHovered}
                        onDropdownOpenChange={this.handleColormapDropdownOpenChange}
                        enableAdditionalColor={true}
                        onCustomColorSelect={renderConfig.setCustomHexEnd}
                        onCustomColorStartSelect={renderConfig.setCustomHexStart}
                        selectedCustomColor={renderConfig.customColormapHexEnd}
                        customColorStart={renderConfig.customColormapHexStart}
                    />
                </FormGroup>
                <FormGroup label={"Invert colormap"} inline={true}>
                    <Switch checked={renderConfig.isInverted} onChange={this.handleInvertedChanged} />
                </FormGroup>
                {this.renderScalingParameter(renderConfig)}
                <FormGroup inline={true}>
                    <Button variant="minimal" className={"bias-contrast-button"} endIcon={this.isExtendBiasContrast ? "double-chevron-up" : "double-chevron-down"} alignText={"right"} size="small" onClick={this.switchExtendBiasContrast}>
                        {"Bias / Contrast"}
                    </Button>
                </FormGroup>
                <Collapse isOpen={this.isExtendBiasContrast}>
                    <BiasContrastSelectComponent
                        bias={renderConfig.bias}
                        contrast={renderConfig.contrast}
                        setBias={renderConfig.setBias}
                        setContrast={renderConfig.setContrast}
                        setBiasContrast={renderConfig.setBiasContrast}
                        resetBias={renderConfig.resetBias}
                        resetContrast={renderConfig.resetContrast}
                        boardWidth={130}
                        boardHeight={130}
                        biasMin={RenderConfigStore.BIAS_MIN}
                        biasMax={RenderConfigStore.BIAS_MAX}
                        contrastMin={RenderConfigStore.CONTRAST_MIN}
                        contrastMax={RenderConfigStore.CONTRAST_MAX}
                    />
                </Collapse>
                <FormGroup inline={true} label="NaN color" className="nan-color-button">
                    <ColorPickerComponent
                        color={tinycolor(preference.nanColorHex).toRgb()}
                        presetColors={[...SWATCH_COLORS, "transparent"]}
                        setColor={(color: ColorResult) => {
                            const colorStr = color.hex === "transparent" ? "rgba(0, 0, 0, 0)" : tinycolor(color.rgb).toRgbString();
                            preference.setPreference(PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX, colorStr);
                        }}
                        disableAlpha={false}
                        darkTheme={appStore.isDarkTheme}
                    />
                </FormGroup>
            </React.Fragment>
        );
    }
}
