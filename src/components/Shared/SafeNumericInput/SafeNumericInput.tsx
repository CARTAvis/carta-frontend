import * as React from "react";
import {NumericInput, INumericInputProps} from "@blueprintjs/core";

export interface SafeNumericInputProps extends INumericInputProps {
    integerOnly?: boolean;
    handleBlur? (ev: React.FocusEvent<HTMLInputElement>) : void;
    handleKeyDown? (ev: React.KeyboardEvent<HTMLInputElement>) : void; 
}

export class SafeNumericInput extends React.Component<SafeNumericInputProps> {
    safeHandleValueChanged = (valueAsNumber: number, valueAsString: string, inputElement: HTMLInputElement) => {
        if (this.props.integerOnly) {
            const roundValue = Math.ceil(valueAsNumber);
            if (isFinite(roundValue)) {
                valueAsNumber = roundValue;
                valueAsString = roundValue.toString();
                inputElement.value = roundValue.toString();
            }
        }

        if (this.props.onValueChange && isFinite(valueAsNumber) && (!this.props.min || this.props.min <= valueAsNumber) && (!this.props.max || this.props.max >= valueAsNumber)) {    
            this.props.onValueChange(valueAsNumber, valueAsString, inputElement);
        }
    };

    render() {
        return (
            <NumericInput
                allowNumericCharactersOnly={this.props.allowNumericCharactersOnly}
                asyncControl={true}
                buttonPosition={this.props.buttonPosition}
                clampValueOnBlur={this.props.clampValueOnBlur}
                className={this.props.className}
                defaultValue={this.props.defaultValue}
                disabled={this.props.disabled}
                fill={this.props.fill}
                inputRef={this.props.inputRef}
                intent={this.props.intent}
                large={this.props.large}
                leftIcon={this.props.leftIcon}
                locale={this.props.locale}
                majorStepSize={this.props.majorStepSize}
                max={this.props.max}
                min={this.props.min}
                minorStepSize={this.props.minorStepSize}
                onButtonClick={this.props.onButtonClick}
                onValueChange={this.safeHandleValueChanged}
                placeholder={this.props.placeholder}
                rightElement={this.props.rightElement}
                selectAllOnFocus={this.props.selectAllOnFocus}
                selectAllOnIncrement={this.props.selectAllOnIncrement}
                stepSize = {this.props.stepSize}
                value={this.props.value}
                onBlur={this.props.handleBlur}
                onKeyDown={this.props.handleKeyDown}
            />
        );
    }
}