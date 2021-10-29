import * as React from "react";
import {NumericInput, INumericInputProps} from "@blueprintjs/core";

export interface SafeNumericInputProps extends INumericInputProps {
    intOnly?: boolean;
    onBlur?(ev: React.FocusEvent<HTMLInputElement>): void;
    onKeyDown?(ev: React.KeyboardEvent<HTMLInputElement>): void;
}

export class SafeNumericInput extends React.Component<SafeNumericInputProps> {
    private static minorStepSize = 0.001;

    safeHandleValueChanged = (valueAsNumber: number, valueAsString: string, inputElement: HTMLInputElement) => {
        if (this.props.intOnly) {
            const roundValue = Math.ceil(valueAsNumber);
            if (isFinite(roundValue)) {
                valueAsNumber = roundValue;
                valueAsString = roundValue.toString();
                inputElement.value = roundValue.toString();
            }
        }
        if (this.props.onValueChange && isFinite(valueAsNumber) && (!isFinite(this.props.min) || this.props.min <= valueAsNumber) && (!isFinite(this.props.max) || this.props.max >= valueAsNumber)) {
            this.props.onValueChange(valueAsNumber, valueAsString, inputElement);
        }
    };

    render() {
        const {intOnly, ...otherProps} = this.props;

        return <NumericInput {...otherProps} asyncControl={true} minorStepSize={this.props.minorStepSize ? this.props.minorStepSize : intOnly ? 1 : SafeNumericInput.minorStepSize} onValueChange={this.safeHandleValueChanged} />;
    }
}
