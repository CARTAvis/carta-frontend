import * as React from "react";
import {ColorResult} from "react-color";
import {Button, Collapse, FormGroup, Switch} from "@blueprintjs/core";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import tinycolor from "tinycolor2";

import {BiasContrastSelectComponent, ColormapComponent, ColorPickerComponent, SafeNumericInput, ScalingSelectComponent} from "components/Shared";
import {AppStore, PreferenceKeys} from "stores";
import {FrameScaling, RenderConfigStore} from "stores/Frame";
import {SWATCH_COLORS} from "utilities";

interface ColormapConfigProps {
    renderConfig: RenderConfigStore;
}

@observer
export class ColormapConfigComponent extends React.Component<ColormapConfigProps> {
    @observable extendBiasContrast: boolean = false;

    @action switchExtendBiasContrast = () => {
        this.extendBiasContrast = !this.extendBiasContrast;
    };

    constructor(props) {
        super(props);
        makeObservable(this);
    }

    handleInvertedChanged: React.FormEventHandler<HTMLInputElement> = evt => {
        this.props.renderConfig.setInverted(evt.currentTarget.checked);
    };

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
                    <ScalingSelectComponent selectedItem={renderConfig.scaling} onItemSelect={renderConfig.setScaling} />
                </FormGroup>
                <FormGroup label={"Colormap"} inline={true}>
                    <ColormapComponent inverted={renderConfig.inverted} selectedItem={renderConfig.colorMap} onItemSelect={renderConfig.setColorMap} enableAdditionalColor={true} frame={appStore.activeFrame} />
                </FormGroup>
                <FormGroup label={"Invert colormap"} inline={true}>
                    <Switch checked={renderConfig.inverted} onChange={this.handleInvertedChanged} />
                </FormGroup>
                {(renderConfig.scaling === FrameScaling.LOG || renderConfig.scaling === FrameScaling.POWER) && (
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
                    <Button minimal={true} className={"bias-contrast-button"} rightIcon={this.extendBiasContrast ? "double-chevron-up" : "double-chevron-down"} alignText={"right"} small={true} onClick={this.switchExtendBiasContrast}>
                        {"Bias / Contrast"}
                    </Button>
                </FormGroup>
                <Collapse isOpen={this.extendBiasContrast}>
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
                        darkTheme={appStore.darkTheme}
                    />
                </FormGroup>
            </React.Fragment>
        );
    }
}
