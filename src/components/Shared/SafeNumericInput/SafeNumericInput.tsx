import * as React from "react";
import {INumericInputProps, NumericInput} from "@blueprintjs/core";

const KEYCODE_ENTER = 13;

export interface SafeNumericInputProps extends INumericInputProps {
    intOnly?: boolean;
    onValueChange?: (val: number) => void;
    onBlur?(ev: React.FocusEvent<HTMLInputElement>): void;
    onKeyDown?(ev: React.KeyboardEvent<HTMLInputElement>): void;
}

export class SafeNumericInput extends React.Component<SafeNumericInputProps> {
    private static minorStepSize = 0.001;

    handleOnKeyDown = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const val = parseFloat(this.validation(ev.currentTarget.value));
        this.props.onValueChange(val);
    };

    handleOnBlur = (ev: React.FocusEvent<HTMLInputElement>) => {
        this.handleOnKeyDown(ev);
    };

    private validation = (value: string): string => {
        const valueAsNumber = parseFloat(value);
        let valueAsString = value;
        if (this.props.intOnly) {
            const roundValue = Math.ceil(valueAsNumber);
            if (isFinite(roundValue)) {
                valueAsString = roundValue.toString();
            }
        }

        if (this.props.onValueChange && isFinite(valueAsNumber) && (!isFinite(this.props.min) || this.props.min <= valueAsNumber) && (!isFinite(this.props.max) || this.props.max >= valueAsNumber)) {
            valueAsString = valueAsNumber.toString();
        }
        return valueAsString;
    };

    render() {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {intOnly, onValueChange, onBlur, onKeyDown, ...otherProps} = this.props;

        return (
            <NumericInput
                {...otherProps}
                asyncControl={true}
                minorStepSize={this.props.minorStepSize ? this.props.minorStepSize : intOnly ? 1 : SafeNumericInput.minorStepSize}
                onKeyDown={onKeyDown ?? this.handleOnKeyDown}
                onBlur={onBlur ?? this.handleOnBlur}
            />
        );
    }
}
