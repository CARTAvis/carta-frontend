import * as React from "react";
import {type ColorResult} from "react-color";
import {Button, Collapse, FormGroup, Switch} from "@blueprintjs/core";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import tinycolor from "tinycolor2";

import {BiasContrastSelectComponent, ColormapComponent, ColorPickerComponent, SafeNumericInput, ScalingSelectComponent} from "components/Shared";
import {FrameScaling, PreferenceKeys} from "enums";
import {AppStore} from "stores";
import {RenderConfigStore} from "stores/Frame";
import {SWATCH_COLORS} from "utilities";

interface ColormapConfigProps {
    renderConfig: RenderConfigStore;
}

@observer
export class ColormapConfigComponent extends React.Component<ColormapConfigProps> {
    @observable isExtendBiasContrast: boolean = false;
    private previewBaseScaling: FrameScaling | null = null;
    private isPreviewCommitted: boolean = false;

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

    private resetScalingPreviewSession = () => {
        this.previewBaseScaling = null;
        this.isPreviewCommitted = false;
    };

    private revertScalingPreview = () => {
        const renderConfig = this.props.renderConfig;
        if (!this.isPreviewCommitted && this.previewBaseScaling !== null && renderConfig.scaling !== this.previewBaseScaling) {
            renderConfig.setScaling(this.previewBaseScaling);
        }
        this.resetScalingPreviewSession();
    };

    private handleScalingHovered = (scaling: FrameScaling) => {
        const renderConfig = this.props.renderConfig;
        if (this.previewBaseScaling === null) {
            this.previewBaseScaling = renderConfig.scaling;
        }
        if (renderConfig.scaling !== scaling) {
            renderConfig.setScaling(scaling);
        }
    };

    private handleScalingSelected = (scaling: FrameScaling) => {
        this.isPreviewCommitted = true;
        this.props.renderConfig.setScaling(scaling);
    };

    private handleScalingDropdownOpenChange = (isOpen: boolean) => {
        if (isOpen) {
            this.resetScalingPreviewSession();
        } else {
            this.revertScalingPreview();
        }
    };

    componentWillUnmount(): void {
        this.revertScalingPreview();
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
                        onColormapSelect={renderConfig.setColorMap}
                        enableAdditionalColor={true}
                        onCustomColorSelect={renderConfig.setCustomHexEnd}
                        selectedCustomColor={renderConfig.customColormapHexEnd}
                        customColorStart={renderConfig.customColormapHexStart}
                    />
                </FormGroup>
                <FormGroup label={"Invert colormap"} inline={true}>
                    <Switch checked={renderConfig.isInverted} onChange={this.handleInvertedChanged} />
                </FormGroup>
                {(renderConfig.scaling === FrameScaling.LOG || renderConfig.scaling === FrameScaling.POWER || renderConfig.scaling === FrameScaling.SINH || renderConfig.scaling === FrameScaling.ASINH) && (
                    <FormGroup label={"Alpha"} inline={true}>
                        <SafeNumericInput min={RenderConfigStore.ALPHA_MIN} max={RenderConfigStore.ALPHA_MAX} buttonPosition={"none"} value={renderConfig.alpha} onValueChange={renderConfig.setAlpha} />
                    </FormGroup>
                )}
                {renderConfig.scaling === FrameScaling.GAMMA && (
                    <FormGroup label={"Gamma"} inline={true}>
                        <SafeNumericInput
                            className={"step-input"}
                            min={RenderConfigStore.GAMMA_MIN}
                            max={RenderConfigStore.GAMMA_MAX}
                            stepSize={0.1}
                            minorStepSize={0.01}
                            majorStepSize={0.5}
                            value={renderConfig.gamma}
                            onValueChange={renderConfig.setGamma}
                        />
                    </FormGroup>
                )}
                <FormGroup inline={true}>
                    <Button minimal={true} className={"bias-contrast-button"} rightIcon={this.isExtendBiasContrast ? "double-chevron-up" : "double-chevron-down"} alignText={"right"} small={true} onClick={this.switchExtendBiasContrast}>
                        {"Bias / Contrast"}
                    </Button>
                </FormGroup>
                <Collapse isOpen={this.isExtendBiasContrast}>
                    <BiasContrastSelectComponent
                        bias={renderConfig.bias}
                        contrast={renderConfig.contrast}
                        setBias={renderConfig.setBias}
                        setContrast={renderConfig.setContrast}
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
                        color={tinycolor(preference.nanColorHex).setAlpha(preference.nanAlpha).toRgb()}
                        presetColors={[...SWATCH_COLORS, "transparent"]}
                        setColor={(color: ColorResult) => {
                            preference.setPreference(PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX, color.hex === "transparent" ? "#000000" : color.hex);
                            preference.setPreference(PreferenceKeys.RENDER_CONFIG_NAN_ALPHA, color.rgb.a);
                        }}
                        disableAlpha={false}
                        darkTheme={appStore.isDarkTheme}
                    />
                </FormGroup>
            </React.Fragment>
        );
    }
}
