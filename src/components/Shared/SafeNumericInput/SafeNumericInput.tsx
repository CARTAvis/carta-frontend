import * as React from "react";
import {NumericInput, NumericInputProps} from "@blueprintjs/core";
import {action, makeObservable, observable, reaction} from "mobx";
import {observer} from "mobx-react";

export interface SafeNumericInputProps extends NumericInputProps {
    intOnly?: boolean;
    onBlur?(ev: React.FocusEvent<HTMLInputElement>): void;
    onKeyDown?(ev: React.KeyboardEvent<HTMLInputElement>): void;
}

@observer
export class SafeNumericInput extends React.Component<SafeNumericInputProps> {
    private static minorStepSize = 0.001;
    @observable valueString: string = this.props.value?.toString();
    @observable private isFocused: boolean = false;

    constructor(props) {
        super(props);
        makeObservable(this);

        reaction(
            () => this.props.value,
            value => {
                if (!this.isFocused) {
                    this.setValueString(value.toString());
                }
            }
        );
    }

    @action setFocused(value: boolean) {
        this.isFocused = value;
    }

    handleOnFocus = () => {
        this.setFocused(true);
    };

    handleOnBlur = () => {
        this.setFocused(false);
    };

    @action setValueString = (valueString: string) => {
        this.valueString = valueString;
    };

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
            this.setValueString(valueAsString);
        }
    };

    render() {
        const {onBlur, intOnly, ...otherProps} = this.props;

        return (
            <NumericInput
                {...otherProps}
                asyncControl={true}
                minorStepSize={this.props.minorStepSize ? this.props.minorStepSize : intOnly ? 1 : SafeNumericInput.minorStepSize}
                onValueChange={this.safeHandleValueChanged}
                value={onBlur || this.props.onKeyDown ? this.props.value : this.valueString}
                onBlur={onBlur ?? this.handleOnBlur}
                onFocus={this.handleOnFocus}
            />
        );
    }
}
