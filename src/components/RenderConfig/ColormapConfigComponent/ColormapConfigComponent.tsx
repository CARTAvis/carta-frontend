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

@observer
export class ColormapConfigComponent extends React.Component<ColormapConfigProps> {
    @observable isExtendBiasContrast: boolean = false;
    private scalingPreviewSession: ScalingPreviewSession | null = null;

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
        const parameterConfig = getScalingParameterConfig(renderConfig.scaling);
        if (!parameterConfig) {
            return null;
        }

        const isGamma = renderConfig.scaling === FrameScaling.GAMMA;
        return (
            <FormGroup label={isGamma ? "Gamma" : "Alpha"} inline={true}>
                <ScalingParameterControlComponent
                    scaling={renderConfig.scaling}
                    min={parameterConfig.min}
                    max={parameterConfig.max}
                    value={isGamma ? renderConfig.gamma : renderConfig.alpha}
                    onValueChange={isGamma ? renderConfig.setGamma : renderConfig.setAlpha}
                />
            </FormGroup>
        );
    }

    private revertScalingPreview = () => {
        const session = this.scalingPreviewSession;
        this.scalingPreviewSession = null;

        if (session && session.renderConfig.scaling !== session.baseScaling) {
            session.renderConfig.setScaling(session.baseScaling);
        }
    };

    private handleScalingHovered = (scaling: FrameScaling) => {
        const renderConfig = this.props.renderConfig;
        if (this.scalingPreviewSession?.renderConfig !== renderConfig) {
            this.revertScalingPreview();
            this.scalingPreviewSession = {renderConfig, baseScaling: renderConfig.scaling};
        }
        if (renderConfig.scaling !== scaling) {
            renderConfig.setScaling(scaling);
        }
    };

    private handleScalingSelected = (scaling: FrameScaling) => {
        this.scalingPreviewSession = null;
        this.props.renderConfig.setScaling(scaling);
    };

    private handleScalingDropdownOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            this.revertScalingPreview();
        }
    };

    componentDidUpdate(prevProps: ColormapConfigProps): void {
        if (prevProps.renderConfig !== this.props.renderConfig) {
            this.revertScalingPreview();
        }
    }

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
