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
const DISPLAY_DECIMAL_PLACES = 6;

function usesDescendingLogScale(scaling: FrameScaling): boolean {
    return scaling === FrameScaling.SINH || scaling === FrameScaling.ASINH;
}

interface ScalingParameterControlProps {
    scaling: FrameScaling;
    value?: number;
    min: number;
    max: number;
    onValueChange: (value: number) => void;
    className?: string;
    disabled?: boolean;
}

/** Convert a scaling parameter to its slider position. */
export function scalingParameterToSliderValue(scaling: FrameScaling, value: number, min: number, max: number): number {
    const clampedValue = clamp(value, min, max);
    if (scaling === FrameScaling.GAMMA) {
        const defaultValue = clamp(getDefaultScalingParameter(scaling), min, max);
        if (clampedValue <= defaultValue) {
            return defaultValue === min ? SLIDER_MIN : SLIDER_MIDPOINT * ((clampedValue - min) / (defaultValue - min));
        }
        return defaultValue === max ? SLIDER_MAX : SLIDER_MIDPOINT + (SLIDER_MAX - SLIDER_MIDPOINT) * ((clampedValue - defaultValue) / (max - defaultValue));
    }

    const logRange = Math.log(max / min);
    const normalizedValue = usesDescendingLogScale(scaling) ? Math.log(max / clampedValue) / logRange : Math.log(clampedValue / min) / logRange;
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
    const logRange = Math.log(max / min) * normalizedValue;
    return usesDescendingLogScale(scaling) ? Math.exp(Math.log(max) - logRange) : Math.exp(Math.log(min) + logRange);
}

export const ScalingParameterControlComponent: React.FC<ScalingParameterControlProps> = ({scaling, value, min, max, onValueChange, className, disabled: isDisabled}) => {
    const isGamma = scaling === FrameScaling.GAMMA;
    const parameterName = isGamma ? "gamma" : "alpha";
    const effectiveValue = value ?? clamp(getDefaultScalingParameter(scaling), min, max);
    const stepSize = isGamma ? 0.1 : effectiveValue * 0.1;
    const minorStepSize = isGamma ? 0.01 : effectiveValue * 0.01;
    const majorStepSize = isGamma ? 0.5 : effectiveValue * 0.5;
    const sliderValue = scalingParameterToSliderValue(scaling, effectiveValue, min, max);
    const displayValue = value === undefined ? "" : Number(value.toFixed(DISPLAY_DECIMAL_PLACES));
    const handleSliderChange = (newSliderValue: number) => {
        onValueChange(sliderValueToScalingParameter(scaling, newSliderValue, min, max));
    };
    const handleReset = () => {
        onValueChange(clamp(getDefaultScalingParameter(scaling), min, max));
    };

    return (
        <div className={classNames("scaling-parameter-control", className)}>
            <SafeNumericInput
                key={`scaling-parameter-input-${scaling}`}
                min={min}
                max={max}
                stepSize={stepSize}
                minorStepSize={minorStepSize}
                majorStepSize={majorStepSize}
                value={displayValue}
                disabled={isDisabled}
                selectAllOnFocus={true}
                buttonPosition="none"
                clampValueOnBlur={true}
                onValueChange={onValueChange}
            />
            <div className="scaling-parameter-slider-row">
                <Button
                    className="scaling-parameter-reset"
                    icon="refresh"
                    variant="minimal"
                    size="small"
                    aria-label={`Reset ${parameterName} to default`}
                    title={`Reset ${parameterName} to default`}
                    disabled={isDisabled}
                    onClick={handleReset}
                />
                <Slider
                    key={`scaling-parameter-slider-${scaling}`}
                    className="scaling-parameter-slider"
                    min={SLIDER_MIN}
                    max={SLIDER_MAX}
                    stepSize={SLIDER_STEP_SIZE}
                    labelRenderer={false}
                    value={sliderValue}
                    disabled={isDisabled}
                    onChange={handleSliderChange}
                    handleHtmlProps={{"aria-label": `Scaling ${parameterName}`}}
                />
            </div>
        </div>
    );
};
