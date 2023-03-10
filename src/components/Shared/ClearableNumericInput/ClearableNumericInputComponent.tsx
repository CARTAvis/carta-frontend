import * as React from "react";
import {AnchorButton, FormGroup, NumericInput, NumericInputProps} from "@blueprintjs/core";
import {Placement, Tooltip2} from "@blueprintjs/popover2";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {toExponential} from "utilities";

const KEYCODE_ENTER = 13;

export interface ClearableNumericInputProps extends NumericInputProps {
    label: string;
    labelInfo?: string;
    value: number;
    min?: number;
    max?: number;
    integerOnly?: boolean;
    onValueChanged: (val: number) => void;
    onValueCleared: () => void;
    displayExponential?: boolean;
    resetDisabled?: boolean;
    tooltipContent?: string;
    tooltipPlacement?: Placement;
    inline?: boolean;
    focused?: boolean;
}

@observer
export class ClearableNumericInputComponent extends React.Component<ClearableNumericInputProps> {
    componentDidMount() {
        if (this.props.focused) {
            this.inputRef?.current?.setSelectionRange(0, 0);
            this.inputRef?.current?.focus();
            this.inputRef?.current?.select();
        }
    }

    componentDidUpdate() {
        if (this.props.focused) {
            this.inputRef?.current?.setSelectionRange(0, 0);
            this.inputRef?.current?.focus();
            this.inputRef?.current?.select();
        }
    }

    private static minorStepSize = 0.001;
    private inputRef = React.createRef<any>();

    @observable private isFocused: boolean = false;

    constructor(props: ClearableNumericInputProps) {
        super(props);
        makeObservable(this);
    }

    @action setFocused(value: boolean) {
        this.isFocused = value;
    }

    handleChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const val = parseFloat(this.validation(ev.currentTarget.value));
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
    };

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
    };

    render() {
        let value: number | string = this.props.value;
        if (value !== undefined) {
            value = this.props.displayExponential && !this.isFocused ? toExponential(Number(this.props.value), 3) : this.props.value;
        }
        return (
            <FormGroup className={this.props.className} label={this.props.label} labelInfo={this.props.labelInfo} inline={this.props.inline === undefined} disabled={this.props.disabled}>
                <NumericInput
                    inputRef={this.inputRef}
                    asyncControl={true}
                    stepSize={this.props.stepSize}
                    value={value}
                    minorStepSize={this.props.minorStepSize ?? ClearableNumericInputComponent.minorStepSize}
                    onFocus={this.handleOnFocus}
                    onBlur={this.handleOnBlur}
                    onKeyDown={this.handleChange}
                    buttonPosition="none"
                    disabled={this.props.disabled}
                    rightElement={
                        <Tooltip2 content={this.props.tooltipContent ?? "Reset value to default"} disabled={this.props.disabled || this.props.resetDisabled} placement={this.props.tooltipPlacement ?? "auto"}>
                            <AnchorButton icon="refresh" minimal={true} onClick={this.props.onValueCleared} disabled={this.props.disabled || this.props.resetDisabled} />
                        </Tooltip2>
                    }
                    placeholder={this.props.placeholder}
                />
            </FormGroup>
        );
    }
}
