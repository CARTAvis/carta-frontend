import * as React from "react";
import {observer} from "mobx-react";
import {FormGroup, Switch} from "@blueprintjs/core";
import {FrameScaling, RenderConfigStore} from "stores";
import {ColormapComponent, ScalingSelectComponent, SafeNumericInput} from "components/Shared";

interface ColormapConfigProps {
    renderConfig: RenderConfigStore;
}

@observer
export class ColormapConfigComponent extends React.Component<ColormapConfigProps> {

    handleInvertedChanged: React.FormEventHandler<HTMLInputElement> = (evt) => {
        this.props.renderConfig.setInverted(evt.currentTarget.checked);
    };

    render() {
        if (!this.props.renderConfig) {
            return null;
        }

        const renderConfig = this.props.renderConfig;
        return (
            <React.Fragment>
                <FormGroup label={"Color map"} inline={true}>
                    <ColormapComponent
                        inverted={renderConfig.inverted}
                        selectedItem={renderConfig.colorMap}
                        onItemSelect={renderConfig.setColorMap}
                    />
                </FormGroup>
                <FormGroup label={"Invert color map"} inline={true}>
                    <Switch
                        checked={renderConfig.inverted}
                        onChange={this.handleInvertedChanged}
                    />
                </FormGroup>
                <FormGroup label={"Scaling"} inline={true}>
                    <ScalingSelectComponent
                        selectedItem={renderConfig.scaling}
                        onItemSelect={renderConfig.setScaling}
                    />
                </FormGroup>
                {(renderConfig.scaling === FrameScaling.LOG || renderConfig.scaling === FrameScaling.POWER) &&
                <FormGroup label={"Alpha"} inline={true}>
                    <SafeNumericInput
                        buttonPosition={"none"}
                        value={renderConfig.alpha}
                        onValueChange={renderConfig.setAlpha}
                    />
                </FormGroup>
                }
                {renderConfig.scaling === FrameScaling.GAMMA &&
                <FormGroup label={"Gamma"} inline={true}>
                    <SafeNumericInput
                        min={RenderConfigStore.GAMMA_MIN}
                        max={RenderConfigStore.GAMMA_MAX}
                        stepSize={0.1}
                        minorStepSize={0.01}
                        majorStepSize={0.5}
                        value={renderConfig.gamma}
                        onValueChange={renderConfig.setGamma}
                    />
                </FormGroup>
                }
                <FormGroup label={"Bias"} inline={true}>
                    <SafeNumericInput
                        min={RenderConfigStore.BIAS_MIN}
                        max={RenderConfigStore.BIAS_MAX}
                        stepSize={0.1}
                        minorStepSize={0.01}
                        majorStepSize={0.5}
                        value={renderConfig.bias}
                        onValueChange={renderConfig.setBias}
                    />
                </FormGroup>
                <FormGroup label={"Contrast"} inline={true}>
                    <SafeNumericInput
                        min={RenderConfigStore.CONTRAST_MIN}
                        max={RenderConfigStore.CONTRAST_MAX}
                        stepSize={0.1}
                        minorStepSize={0.01}
                        majorStepSize={0.5}
                        value={renderConfig.contrast}
                        onValueChange={renderConfig.setContrast}
                    />
                </FormGroup>
            </React.Fragment>
        )
    }
}