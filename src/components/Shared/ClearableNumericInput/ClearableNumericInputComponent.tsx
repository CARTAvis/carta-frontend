import * as React from "react";
import {Button, FormGroup, NumericInput, Tooltip, INumericInputProps} from "@blueprintjs/core";
import {observer} from "mobx-react";
import {observable} from "mobx";
import {toExponential} from "utilities";

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

    handleOnFocus = () => {
        if (this.props.displayExponential) {
            this.isFocused = true;
        }
    };

    handleOnBlur = () => {
        if (this.props.displayExponential) {
            this.isFocused = false;
        }
    }

    handleOnValueChange = (val) => {
        if (isFinite(val)) {
            this.props.onValueChanged(val);
        }
    }

    render () {
        let value = this.props.displayExponential && !this.isFocused ? toExponential(this.props.value, 3) : this.props.value;
        return (
        <FormGroup className={this.props.className} label={this.props.label} inline={true} disabled={this.props.disabled}>
            <NumericInput
                value={value}
                onFocus={this.handleOnFocus}
                onBlur={this.handleOnBlur}
                onValueChange={(val) => this.handleOnValueChange(val)}
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
