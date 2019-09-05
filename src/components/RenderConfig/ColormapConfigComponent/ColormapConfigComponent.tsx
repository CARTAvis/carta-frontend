import * as React from "react";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {Alert, Button, FormGroup, IPopoverProps, MenuItem, NumericInput} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {FrameScaling, RenderConfigStore} from "stores/RenderConfigStore";
import {ScalingComponent} from "./ScalingComponent";
import {ColormapComponent} from "./ColormapComponent";

const HistogramSelect = Select.ofType<boolean>();

interface ColormapConfigProps {
    renderConfig: RenderConfigStore;
    onCubeHistogramSelected: () => void;
    onCubeHistogramCancelled?: () => void;
    darkTheme: boolean;
    showHistogramSelect: boolean;
    disableHistogramSelect: boolean;
}

const SCALING_POPOVER_PROPS: Partial<IPopoverProps> = {minimal: true, position: "auto-end", popoverClassName: "colormap-select-popover"};

@observer
export class ColormapConfigComponent extends React.Component<ColormapConfigProps> {

    @observable showCubeHistogramAlert: boolean;

    renderHistogramSelectItem = (isCube: boolean, {handleClick, modifiers, query}) => {
        return <MenuItem text={isCube ? "Per-Cube" : "Per-Channel"} onClick={handleClick} key={isCube ? "cube" : "channel"}/>;
    };

    handleGammaChange = (value: number) => {
        if (isFinite(value)) {
            this.props.renderConfig.setGamma(value);
        }
    };

    handleAlphaChange = (value: number) => {
        if (isFinite(value)) {
            this.props.renderConfig.setAlpha(value);
        }
    };

    handleHistogramChange = (value: boolean) => {
        if (value && !this.props.renderConfig.cubeHistogram) {
            this.showCubeHistogramAlert = true;
        } else {
            this.props.renderConfig.setUseCubeHistogram(value);
        }
    };

    render() {
        if (!this.props.renderConfig) {
            return null;
        }

        const renderConfig = this.props.renderConfig;
        return (
            <React.Fragment>
                {this.props.showHistogramSelect &&
                <FormGroup label={"Histogram"} inline={true} disabled={this.props.disableHistogramSelect}>
                    <HistogramSelect
                        activeItem={renderConfig.useCubeHistogram}
                        popoverProps={SCALING_POPOVER_PROPS}
                        filterable={false}
                        items={[true, false]}
                        onItemSelect={this.handleHistogramChange}
                        itemRenderer={this.renderHistogramSelectItem}
                        disabled={this.props.disableHistogramSelect}
                    >
                        <Button text={renderConfig.useCubeHistogram ? "Per-Cube" : "Per-Channel"} rightIcon="double-caret-vertical" alignText={"right"} disabled={this.props.disableHistogramSelect}/>
                    </HistogramSelect>
                </FormGroup>
                }
                <FormGroup label={"Scaling"} inline={true}>
                    <ScalingComponent
                        selectedItem={renderConfig.scaling}
                        onItemSelect={this.props.renderConfig.setScaling}
                    />
                </FormGroup>
                <FormGroup label={"Color map"} inline={true}>
                    <ColormapComponent
                        selectedItem={renderConfig.colorMapName}
                        onItemSelect={this.props.renderConfig.setColorMap}
                    />
                </FormGroup>
                {(renderConfig.scaling === FrameScaling.LOG || renderConfig.scaling === FrameScaling.POWER) &&
                <FormGroup label={"Alpha"} inline={true}>
                    <NumericInput
                        buttonPosition={"none"}
                        value={renderConfig.alpha}
                        onValueChange={this.handleAlphaChange}
                    />
                </FormGroup>
                }
                {renderConfig.scaling === FrameScaling.GAMMA &&
                <FormGroup label={"Gamma"} inline={true}>
                    <NumericInput
                        min={RenderConfigStore.GAMMA_MIN}
                        max={RenderConfigStore.GAMMA_MAX}
                        stepSize={0.1}
                        minorStepSize={0.01}
                        majorStepSize={0.5}
                        value={renderConfig.gamma}
                        onValueChange={this.handleGammaChange}
                    />
                </FormGroup>
                }
                <Alert icon={"time"} isOpen={this.showCubeHistogramAlert} onCancel={this.handleAlertCancel} onConfirm={this.handleAlertConfirm} cancelButtonText={"Cancel"}>
                    <p>
                        Calculating a cube histogram may take a long time, depending on the size of the file. Are you sure you want to continue?
                    </p>
                </Alert>
            </React.Fragment>
        );
    }

    private handleAlertConfirm = () => {
        this.props.onCubeHistogramSelected();
        this.showCubeHistogramAlert = false;
    };

    private handleAlertCancel = () => {
        this.showCubeHistogramAlert = false;
    };
}