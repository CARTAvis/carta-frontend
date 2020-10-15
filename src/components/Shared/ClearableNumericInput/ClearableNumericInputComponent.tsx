import * as React from "react";
import {Button, FormGroup, NumericInput, Tooltip, INumericInputProps} from "@blueprintjs/core";
import {observer} from "mobx-react";
import {makeObservable, observable} from "mobx";
import {toExponential} from "utilities";

const KEYCODE_ENTER = 13;

export interface ClearableNumericInputProps extends INumericInputProps {
    label: string; 
    value: number; 
    onValueChanged: (val: number) => void;
    onValueCleared: () => void;
    displayExponential?: boolean;
    updateValueOnKeyDown?: boolean;
}

@observer
export class ClearableNumericInputComponent extends React.Component<ClearableNumericInputProps> {
    @observable private isFocused: boolean = false;
    // trigger keydown update for value
    @observable isKeyDown: boolean = false;

    constructor(props: ClearableNumericInputProps) {
        super(props);
        makeObservable(this);
    }

    handleChange = (ev) => { 
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const val = parseFloat(ev.currentTarget.value);
        if (isFinite(val) && val !== this.props.value) {
            this.props.onValueChanged(val);
        }
        if (this.props.updateValueOnKeyDown) {
            this.props.onValueChanged(val);
            this.isKeyDown = true;   
        }
    };

    handleOnFocus = () => {
        if (this.props.displayExponential) {
            this.isFocused = true;
        }
        if (this.props.updateValueOnKeyDown) {
            this.isFocused = true;
            this.isKeyDown = false;   
        }
    };

    handleOnBlur = (ev: React.FocusEvent<HTMLInputElement>) => {
        this.handleChange(ev);
        if (this.props.displayExponential) {
            this.isFocused = false;
        }
        if (this.props.updateValueOnKeyDown) {
            this.isKeyDown = false;   
            this.isFocused = false;
        }
    }

    handleOnValueChange = () => {
        if (this.props.updateValueOnKeyDown) {
            this.isKeyDown = false;   
        } 
    }

    render () {
        let value = this.props.displayExponential && !this.isFocused ? toExponential(this.props.value, 3) : this.props.value;
        if (this.props.updateValueOnKeyDown) {
            value = this.isFocused && !this.isKeyDown ? this.props.value.toString() : this.props.value;
        }
        return (
        <FormGroup className={this.props.className} label={this.props.label} inline={true} disabled={this.props.disabled}>
            <NumericInput
                value={value}
                onFocus={this.handleOnFocus}
                onBlur={this.handleOnBlur}
                onKeyDown={this.handleChange}
                onValueChange={this.handleOnValueChange}
                buttonPosition="none"
                disabled={this.props.disabled}
                rightElement={
                    <Tooltip content="Reset value to default">
                        <Button icon="refresh" minimal={true} onClick={this.props.onValueCleared} disabled={this.props.disabled}/>
                    </Tooltip>
                }
            />
        </FormGroup>
        );
    }
}
