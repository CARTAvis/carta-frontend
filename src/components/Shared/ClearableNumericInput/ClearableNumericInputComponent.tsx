import * as React from "react";
import {AnchorButton, FormGroup, NumericInput, Tooltip, INumericInputProps} from "@blueprintjs/core";
import {observer} from "mobx-react";
import {action ,makeObservable, observable} from "mobx";
import {toExponential} from "utilities";

const KEYCODE_ENTER = 13;

export interface ClearableNumericInputProps extends INumericInputProps {
    label: string; 
    value: number; 
    min?: number;
    max?: number;
    integerOnly?: boolean;
    onValueChanged: (val: number) => void;
    onValueCleared: () => void;
    displayExponential?: boolean;
    updateValueOnKeyDown?: boolean;
}

@observer
export class ClearableNumericInputComponent extends React.Component<ClearableNumericInputProps> {
    private static minorStepSize = 0.001;

    private defaulteValue: string;
    @observable value: string;
    @observable private isFocused: boolean = false;

    constructor(props: ClearableNumericInputProps) {
        super(props);
        makeObservable(this);
        this.value = this.props.value.toString();
        this.defaulteValue = this.props.value.toString();
    }

    @action setValue(value: string) {
        this.value = value;
    }

    @action setFocused(value: boolean) {
        this.isFocused = value;
    }

    handleChange = (ev) => { 
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        if (!isFinite(parseFloat(this.value))) {
            this.setValue(this.defaulteValue);
        }
        const val = parseFloat(this.validation(this.value));
        this.props.onValueChanged(val);
    };

    handleOnFocus = () => {
        if (this.props.displayExponential) {
            this.setFocused(true);
        }
    };

    handleOnBlur = (ev: React.FocusEvent<HTMLInputElement>) => {
        this.handleChange(ev);
        if (this.props.displayExponential) {
            this.setFocused(false);
        }
    }

    handleOnValueChange = (valueAsNumber: number, valueAsString: string) => {
        this.setValue(this.validation(valueAsString));   
    }

    handelOnValueCleared = () => {
        this.setValue(this.defaulteValue);
        this.props.onValueCleared();
    }

    private validation = (value: string): string => {
        const valueAsNumber = parseFloat(value);
        let valueAsString = value;
        if (this.props.integerOnly) {
            const roundValue = Math.round(valueAsNumber);
            if (isFinite(roundValue)) {
                valueAsString = roundValue.toString();   
            }
        }

        if (this.props.min && valueAsNumber < this.props.min) {
            valueAsString = this.props.min.toString();
        }

        if (this.props.max && valueAsNumber > this.props.max) {
            valueAsString = this.props.max.toString();
        }
        return valueAsString;
    }

    render () {
        let value = this.props.displayExponential && !this.isFocused ? toExponential(Number(this.props.value), 3) : this.props.value;
        return (
        <FormGroup className={this.props.className} label={this.props.label} inline={true} disabled={this.props.disabled}>
            <NumericInput
                asyncControl={true}
                stepSize={this.props.stepSize}
                value={value}
                minorStepSize={this.props.minorStepSize ? this.props.minorStepSize : ClearableNumericInputComponent.minorStepSize}
                onFocus={this.handleOnFocus}
                onBlur={this.handleOnBlur}
                onKeyDown={this.handleChange}
                onValueChange={this.handleOnValueChange}
                buttonPosition="none"
                disabled={this.props.disabled}
                rightElement={
                    <Tooltip content="Reset value to default">
                        <AnchorButton icon="refresh" minimal={true} onClick={this.handelOnValueCleared} disabled={this.props.disabled}/>
                    </Tooltip>
                }
            />
        </FormGroup>
        );
    }
}
