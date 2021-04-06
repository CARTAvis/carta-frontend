import * as React from "react";
import {observer} from "mobx-react";
import {Button, Colors, FormGroup} from "@blueprintjs/core";
import {Circle, Layer, Rect, Stage} from "react-konva";
import {SafeNumericInput} from "components/Shared";
import {RenderConfigStore} from "stores";
import {clamp} from "utilities"

export interface BiasContrastSelectComponentProps {
    bias: number;
    contrast: number;
    setBias(bias: number): void;
    setContrast(contrast: number): void;
    resetBias(): void;
    resetContrast(): void;
    boardWidth: number;
    boardHeight: number;
}

@observer
export class BiasContrastSelectComponent extends React.Component<BiasContrastSelectComponentProps> {

    private handleDragMove = (event) => {
        const stage = event.target.getStage();
        const point = stage.getPointerPosition();

        const bias = clamp(point.x, 0, stage.width()) / stage.width() * 2 - 1;
        const contrast = 2 -  clamp(point.y, 0, stage.height()) / stage.height() * 2;
        this.props.setBias(bias);
        this.props.setContrast(contrast);
    };

    private resetButton = (clickEvent) => {
        return (
            <Button
                icon={"reset"}
                minimal={true}
                small={true}
                style={{opacity: 0.5}}
                onClick={clickEvent}
            />
        )
    };

    render() {
        const twoDimensionBoard = (
            <React.Fragment>
                <Rect
                    x={0}
                    y={0}
                    width={this.props.boardWidth}
                    height={this.props.boardHeight}
                    stroke={Colors.LIGHT_GRAY1}
                    strokeWidth={4}
                />
                <Circle
                    x={(this.props.bias + 1) * this.props.boardWidth / 2}
                    y={(2 - this.props.contrast) * this.props.boardHeight / 2}
                    radius={5}
                    fill={Colors.GRAY3}
                    draggable={true}
                    dragBoundFunc={(pos) => {
                        return {
                          x: clamp(pos.x, 0, this.props.boardWidth),
                          y: clamp(pos.y, 0, this.props.boardHeight)
                        };
                    }}
                    onDragMove={this.handleDragMove}
                />
            </React.Fragment>
        )

        return (
            <React.Fragment>
                <Stage
                    className={"bias-contrast-stage"}
                    width={this.props.boardWidth}
                    height={this.props.boardHeight}
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
                        value={this.props.bias}
                        onValueChange={this.props.setBias}
                        rightElement={this.resetButton(this.props.resetBias)}
                    />
                </FormGroup>
                <FormGroup label={"Contrast"} inline={true}>
                    <SafeNumericInput
                        className={'step-input'}
                        min={RenderConfigStore.CONTRAST_MIN}
                        max={RenderConfigStore.CONTRAST_MAX}
                        stepSize={0.1}
                        majorStepSize={0.5}
                        value={this.props.contrast}
                        onValueChange={this.props.setContrast}
                        rightElement={this.resetButton(this.props.resetContrast)}
                    />
                </FormGroup>
            </React.Fragment>
        );
    }
}