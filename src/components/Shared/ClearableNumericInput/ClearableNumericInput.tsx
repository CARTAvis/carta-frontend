import * as React from "react";
import {Button, FormGroup, NumericInput, Tooltip} from "@blueprintjs/core";

const KEYCODE_ENTER = 13;

export const ClearableNumericInput = (props: { label: string, value: number, onValueChanged: (val: number) => void, onValueCleared: () => void }) => {
    const handleChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        if (isFinite(val) && val !== props.value) {
            props.onValueChanged(val);
        }
    };

    return (
        <FormGroup label={props.label} inline={true}>
            <NumericInput
                value={props.value}
                onBlur={handleChange}
                onKeyDown={handleChange}
                buttonPosition="none"
                rightElement={
                    <Tooltip content="Reset value to default">
                        <Button icon="refresh" minimal={true} onClick={props.onValueCleared}/>
                    </Tooltip>
                }
            />
        </FormGroup>
    );
};
