import {SafeNumericInput} from "..";

const KEYCODE_ENTER = 13;

interface RotationNumericInputProps {
    value: number;
    onChange: (val: string) => boolean; // return success or not for resetting displayed value
    disabled: boolean;
}

export const RotationNumericInput = ({value, onChange, disabled}: RotationNumericInputProps) => {
    const handleChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        if (!onChange(valueString)) {
            // reset displayed value if it's not updated successfully
            ev.currentTarget.value = value;
        }
    };

    return <SafeNumericInput disabled={disabled} selectAllOnFocus={true} buttonPosition="none" placeholder="P.A." value={value} onBlur={handleChange} onKeyDown={handleChange} />;
};
