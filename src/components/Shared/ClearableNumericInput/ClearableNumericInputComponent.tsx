import * as React from "react";
import {Button, FormGroup, NumericInput, Tooltip} from "@blueprintjs/core";
import {observer} from "mobx-react";
import {observable} from "mobx";
import {toExponential} from "utilities";

const KEYCODE_ENTER = 13;

export interface ClearableNumericInputProps {
    label: string; 
    value: number; 
    onValueChanged: (val: number) => void;
    onValueCleared: () => void;
    displayExponential?: boolean;
}

@observer
export class ClearableNumericInputComponent extends React.Component<ClearableNumericInputProps> {

    @observable private isFocused: boolean = false;

    handleChange = (ev) => {
        
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        if (isFinite(val) && val !== this.props.value) {
            this.props.onValueChanged(val);
        }
    };

    handleOnFocus = () => {
        if (this.props.displayExponential) {
            this.isFocused = true;
        }
    };

    handleOnBlur = (ev: React.FocusEvent<HTMLInputElement>) => {
        this.handleChange(ev);
        if (this.props.displayExponential) {
            this.isFocused = false;
        }
    }

    render () {
        return (
        <FormGroup label={this.props.label} inline={true}>
            <NumericInput
                value={this.props.displayExponential && !this.isFocused ? toExponential(this.props.value, 3) : this.props.value}
                onFocus={this.handleOnFocus}
                onBlur={this.handleOnBlur}
                onKeyDown={this.handleChange}
                buttonPosition="none"
                rightElement={
                    <Tooltip content="Reset value to default">
                        <Button icon="refresh" minimal={true} onClick={this.props.onValueCleared}/>
                    </Tooltip>
                }
            />
        </FormGroup>
        );
    }
}
