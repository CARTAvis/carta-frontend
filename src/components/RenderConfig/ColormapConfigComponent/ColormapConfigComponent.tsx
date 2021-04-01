import * as React from "react";
import {observer} from "mobx-react";
import {action, makeObservable, observable} from "mobx";
import {Button, Collapse, Colors, FormGroup, Switch} from "@blueprintjs/core";
import {Circle, Layer, Rect, Stage} from "react-konva";
import {FrameScaling, RenderConfigStore} from "stores";
import {ColormapComponent, ScalingSelectComponent, SafeNumericInput} from "components/Shared";
import {clamp} from "utilities"

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

    handleInvertedChanged: React.FormEventHandler<HTMLInputElement> = (evt) => {
        this.props.renderConfig.setInverted(evt.currentTarget.checked);
    };

    private handleDragMove = (event) => {
        const stage = event.target.getStage();
        const point = stage.getPointerPosition();

        const bias = clamp(point.x, 0, stage.width()) / stage.width() * 2 - 1;
        const contrast = 2 -  clamp(point.y, 0, stage.height()) / stage.height() * 2;
        this.props.renderConfig.setBias(bias);
        this.props.renderConfig.setContrast(contrast); 
    }

    render() {
        if (!this.props.renderConfig) {
            return null;
        }

        const boardWidth = 130;
        const boardHeight = 130;


        const renderConfig = this.props.renderConfig;
        const twoDimensionBoard = (
            <React.Fragment>
                <Rect
                    x={0}
                    y={0}
                    width={boardWidth}
                    height={boardHeight}
                    stroke={Colors.LIGHT_GRAY1}
                    strokeWidth={4}
                />
                <Circle
                    x={(renderConfig.bias + 1) * boardWidth / 2}
                    y={(2 - renderConfig.contrast) * boardHeight / 2}
                    radius={5}
                    fill={Colors.GRAY3}
                    draggable={true}
                    dragBoundFunc={function (pos) {
                        return {
                          x: clamp(pos.x, 0, boardWidth),
                          y: clamp(pos.y, 0, boardHeight)
                        };
                    }}
                    onDragMove={this.handleDragMove}
                />
            </React.Fragment>
        )

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
                        className={'step-input'}
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
                <FormGroup inline={true}>
                    <Button
                        minimal={true}
                        rightIcon={this.extendBiasContrast ? "double-chevron-up" : "double-chevron-down"}
                        alignText={'right'}
                        small={true}
                        style={{marginTop: 5}}
                        onClick={this.switchExtendBiasContrast}
                    >
                        {"Bias / Contrast"}
                    </Button>
                </FormGroup>
                <Collapse isOpen={this.extendBiasContrast}>
                    <Stage
                        className={"bias-contrast-stage"}
                        width={boardWidth}
                        height={boardHeight}
                        style={{paddingBottom: 10}}
                    >
                        <Layer>
                            {twoDimensionBoard}
                        </Layer>
                    </Stage>
                    <FormGroup label={"Bias"} inline={true}>
                        <SafeNumericInput
                            className={'step-input'}
                            min={RenderConfigStore.BIAS_MIN}
                            max={RenderConfigStore.BIAS_MAX}
                            stepSize={0.1}
                            majorStepSize={0.5}
                            value={renderConfig.bias}
                            onValueChange={renderConfig.setBias}
                        />
                    </FormGroup>
                    <FormGroup label={"Contrast"} inline={true}>
                        <SafeNumericInput
                            className={'step-input'}
                            min={RenderConfigStore.CONTRAST_MIN}
                            max={RenderConfigStore.CONTRAST_MAX}
                            stepSize={0.1}
                            majorStepSize={0.5}
                            value={renderConfig.contrast}
                            onValueChange={renderConfig.setContrast}
                        />
                    </FormGroup>
                </Collapse>
            </React.Fragment>
        )
    }
}