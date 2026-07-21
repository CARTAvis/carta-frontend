import * as React from "react";
import {Button, Slider} from "@blueprintjs/core";
import classNames from "classnames";

import {FrameScaling} from "enums";
import {clamp} from "utilities/math/math";
import {getDefaultScalingParameter} from "utilities/scaling/scaling";

import {SafeNumericInput} from "../SafeNumericInput/SafeNumericInput";

import "./ScalingParameterControlComponent.scss";

const SLIDER_MIN = 0;
const SLIDER_MAX = 100;
const SLIDER_MIDPOINT = (SLIDER_MIN + SLIDER_MAX) / 2;
const SLIDER_STEP_SIZE = 0.1;

interface ScalingParameterControlProps {
    scaling: FrameScaling;
    value: number;
    min: number;
    max: number;
    onValueChange: (value: number) => void;
    className?: string;
}

/** Convert a scaling parameter to its slider position. */
export function scalingParameterToSliderValue(scaling: FrameScaling, value: number, min: number, max: number): number {
    const clampedValue = clamp(value, min, max);
    let normalizedValue: number;

    switch (scaling) {
        case FrameScaling.GAMMA: {
            const defaultValue = clamp(getDefaultScalingParameter(scaling), min, max);
            if (clampedValue <= defaultValue) {
                return defaultValue === min ? SLIDER_MIN : SLIDER_MIDPOINT * ((clampedValue - min) / (defaultValue - min));
            }
            return defaultValue === max ? SLIDER_MAX : SLIDER_MIDPOINT + (SLIDER_MAX - SLIDER_MIDPOINT) * ((clampedValue - defaultValue) / (max - defaultValue));
        }
        case FrameScaling.SINH:
        case FrameScaling.ASINH:
            normalizedValue = Math.log(max / clampedValue) / Math.log(max / min);
            break;
        case FrameScaling.POWER:
        case FrameScaling.LOG:
        default:
            normalizedValue = Math.log(clampedValue / min) / Math.log(max / min);
            break;
    }

    return clamp(normalizedValue * SLIDER_MAX, SLIDER_MIN, SLIDER_MAX);
}

/** Convert a slider position back to its scaling parameter. */
export function sliderValueToScalingParameter(scaling: FrameScaling, sliderValue: number, min: number, max: number): number {
    const clampedSliderValue = clamp(sliderValue, SLIDER_MIN, SLIDER_MAX);
    if (scaling === FrameScaling.GAMMA) {
        const defaultValue = clamp(getDefaultScalingParameter(scaling), min, max);
        if (clampedSliderValue <= SLIDER_MIDPOINT) {
            return min + (defaultValue - min) * (clampedSliderValue / SLIDER_MIDPOINT);
        }
        return defaultValue + (max - defaultValue) * ((clampedSliderValue - SLIDER_MIDPOINT) / (SLIDER_MAX - SLIDER_MIDPOINT));
    }

    const normalizedValue = clampedSliderValue / SLIDER_MAX;

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

export const ScalingParameterControlComponent: React.FC<ScalingParameterControlProps> = ({scaling, value, min, max, onValueChange, className}) => {
    const isGamma = scaling === FrameScaling.GAMMA;
    const parameter = isGamma ? "gamma" : "alpha";
    const sliderValue = scalingParameterToSliderValue(scaling, value, min, max);
    const handleSliderChange = (newSliderValue: number) => {
        onValueChange(sliderValueToScalingParameter(scaling, newSliderValue, min, max));
    };
    const handleReset = () => {
        onValueChange(clamp(getDefaultScalingParameter(scaling), min, max));
    };

    return (
        <div className={classNames("scaling-parameter-control", className)}>
            <SafeNumericInput
                min={min}
                max={max}
                stepSize={isGamma ? 0.1 : value * 0.1}
                minorStepSize={isGamma ? 0.01 : value * 0.01}
                majorStepSize={isGamma ? 0.5 : value * 0.5}
                value={value}
                selectAllOnFocus={true}
                buttonPosition="none"
                clampValueOnBlur={true}
                onValueChange={onValueChange}
            />
            <div className="scaling-parameter-slider-row">
                <Button className="scaling-parameter-reset" icon="refresh" variant="minimal" size="small" aria-label={`Reset ${parameter} to default`} title={`Reset ${parameter} to default`} onClick={handleReset} />
                <Slider
                    className="scaling-parameter-slider"
                    min={SLIDER_MIN}
                    max={SLIDER_MAX}
                    stepSize={SLIDER_STEP_SIZE}
                    labelRenderer={false}
                    value={sliderValue}
                    onChange={handleSliderChange}
                    handleHtmlProps={{"aria-label": `Scaling ${parameter}`}}
                />
            </div>
        </div>
    );
};
