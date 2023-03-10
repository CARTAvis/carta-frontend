import * as React from "react";
import {Circle, Layer, Rect, Stage} from "react-konva";
import {Button, Colors, FormGroup} from "@blueprintjs/core";
import Konva from "konva";
import {observer} from "mobx-react";

import {SafeNumericInput} from "components/Shared";
import {clamp} from "utilities";

const DRAG_MOVE_INTERVAL = 10;
const DOUBLE_CLICK_THRESHOLD = 300;

interface BiasContrastSelectComponentProps {
    bias: number;
    contrast: number;
    setBias: (bias: number) => void;
    setContrast: (contrast: number) => void;
    resetBias: () => void;
    resetContrast: () => void;
    boardWidth: number;
    boardHeight: number;
    biasMin: number;
    biasMax: number;
    contrastMin: number;
    contrastMax: number;
}

@observer
export class BiasContrastSelectComponent extends React.Component<BiasContrastSelectComponentProps> {
    private updateValuesTimer;

    private updateValues = (x: number, y: number, interval: number) => {
        clearTimeout(this.updateValuesTimer);
        this.updateValuesTimer = setTimeout(() => {
            const bias = (clamp(x, 0, this.props.boardWidth) / this.props.boardWidth) * (this.props.biasMax - this.props.biasMin) + this.props.biasMin;
            const contrast = this.props.contrastMax - (clamp(y, 0, this.props.boardHeight) / this.props.boardHeight) * (this.props.contrastMax - this.props.contrastMin);
            this.props.setBias(bias);
            this.props.setContrast(contrast);
        }, interval);
    };

    private handleDoubleClick = () => {
        clearTimeout(this.updateValuesTimer);
        this.props.resetBias();
        this.props.resetContrast();
    };

    private handleClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
        const point = event.target.getStage().getPointerPosition();
        this.updateValues(point.x, point.y, DOUBLE_CLICK_THRESHOLD);
    };

    private handleDragMove = (event: Konva.KonvaEventObject<DragEvent>) => {
        const point = event.target.getPosition();
        this.updateValues(point.x, point.y, DRAG_MOVE_INTERVAL);
    };

    private resetButton = handleClick => {
        return <Button icon={"refresh"} minimal={true} small={true} onClick={handleClick} />;
    };

    render() {
        const twoDimensionBoard = (
            <React.Fragment>
                <Rect x={0} y={0} width={this.props.boardWidth} height={this.props.boardHeight} stroke={Colors.LIGHT_GRAY1} strokeWidth={4} onClick={this.handleClick} onDblClick={this.handleDoubleClick} />
                <Circle
                    x={((this.props.bias - this.props.biasMin) * this.props.boardWidth) / (this.props.biasMax - this.props.biasMin)}
                    y={((this.props.contrastMax - this.props.contrast) * this.props.boardHeight) / (this.props.contrastMax - this.props.contrastMin)}
                    radius={5}
                    fill={Colors.GRAY3}
                    draggable={true}
                    dragBoundFunc={pos => ({x: clamp(pos.x, 0, this.props.boardWidth), y: clamp(pos.y, 0, this.props.boardHeight)})}
                    onDragMove={this.handleDragMove}
                    onDblClick={this.handleDoubleClick}
                />
            </React.Fragment>
        );

        return (
            <React.Fragment>
                <Stage className={"bias-contrast-stage"} width={this.props.boardWidth} height={this.props.boardHeight} style={{paddingBottom: 10}}>
                    <Layer>{twoDimensionBoard}</Layer>
                </Stage>
                <FormGroup label={"Bias"} inline={true}>
                    <SafeNumericInput
                        className={"step-input"}
                        min={this.props.biasMin}
                        max={this.props.biasMax}
                        stepSize={0.1}
                        majorStepSize={0.5}
                        value={this.props.bias}
                        onValueChange={this.props.setBias}
                        rightElement={this.resetButton(this.props.resetBias)}
                    />
                </FormGroup>
                <FormGroup label={"Contrast"} inline={true}>
                    <SafeNumericInput
                        className={"step-input"}
                        min={this.props.contrastMin}
                        max={this.props.contrastMax}
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
