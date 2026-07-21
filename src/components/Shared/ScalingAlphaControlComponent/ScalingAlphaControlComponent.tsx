import * as React from "react";
import {Button, Slider} from "@blueprintjs/core";
import classNames from "classnames";

import {FrameScaling} from "enums";
import {clamp} from "utilities/math/math";
import {getDefaultScalingParameter} from "utilities/scaling/scaling";

import {SafeNumericInput} from "../SafeNumericInput/SafeNumericInput";

import "./ScalingAlphaControlComponent.scss";

const SLIDER_MIN = 0;
const SLIDER_MAX = 100;
const SLIDER_STEP_SIZE = 0.1;

interface ScalingAlphaControlProps {
    scaling: FrameScaling;
    value: number;
    min: number;
    max: number;
    onValueChange: (value: number) => void;
    className?: string;
}

/** Convert an alpha value to a logarithmic strength slider position. */
export function alphaToSliderValue(scaling: FrameScaling, alpha: number, min: number, max: number): number {
    const clampedAlpha = clamp(alpha, min, max);
    let normalizedValue: number;

    switch (scaling) {
        case FrameScaling.SINH:
        case FrameScaling.ASINH:
            normalizedValue = Math.log(max / clampedAlpha) / Math.log(max / min);
            break;
        case FrameScaling.POWER:
        case FrameScaling.LOG:
        default:
            normalizedValue = Math.log(clampedAlpha / min) / Math.log(max / min);
            break;
    }

    return clamp(normalizedValue * SLIDER_MAX, SLIDER_MIN, SLIDER_MAX);
}

/** Convert a logarithmic strength slider position back to alpha. */
export function sliderValueToAlpha(scaling: FrameScaling, sliderValue: number, min: number, max: number): number {
    const normalizedValue = clamp(sliderValue, SLIDER_MIN, SLIDER_MAX) / SLIDER_MAX;

    switch (scaling) {
        case FrameScaling.SINH:
        case FrameScaling.ASINH:
            return Math.exp(Math.log(max) - Math.log(max / min) * normalizedValue);
        case FrameScaling.POWER:
        case FrameScaling.LOG:
        default:
            return Math.exp(Math.log(min) + Math.log(max / min) * normalizedValue);
    }
}

export const ScalingAlphaControlComponent: React.FC<ScalingAlphaControlProps> = ({scaling, value, min, max, onValueChange, className}) => {
    const sliderValue = alphaToSliderValue(scaling, value, min, max);
    const handleSliderChange = (newSliderValue: number) => {
        onValueChange(sliderValueToAlpha(scaling, newSliderValue, min, max));
    };
    const handleReset = () => {
        onValueChange(clamp(getDefaultScalingParameter(scaling), min, max));
    };

    return (
        <div className={classNames("scaling-alpha-control", className)}>
            <SafeNumericInput min={min} max={max} stepSize={value * 0.1} minorStepSize={value * 0.01} majorStepSize={value * 0.5} value={value} selectAllOnFocus={true} buttonPosition="none" onValueChange={onValueChange} />
            <div className="scaling-alpha-slider-row">
                <Button className="scaling-alpha-reset" icon="refresh" variant="minimal" size="small" aria-label="Reset alpha to default" title="Reset alpha to default" onClick={handleReset} />
                <Slider
                    className="scaling-alpha-slider"
                    min={SLIDER_MIN}
                    max={SLIDER_MAX}
                    stepSize={SLIDER_STEP_SIZE}
                    labelRenderer={false}
                    value={sliderValue}
                    onChange={handleSliderChange}
                    handleHtmlProps={{"aria-label": "Scaling alpha strength"}}
                />
            </div>
        </div>
    );
};
