import {Position} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";

import {AppStore, NUMBER_FORMAT_LABEL} from "stores";
import {CoordinateMode} from "stores/Frame";

import {SafeNumericInput} from "..";

const KEYCODE_ENTER = 13;

export enum InputType {
    XCoord = "XCoord",
    YCoord = "YCoord",
    Size = "Size"
}

type WcsCoordNumericInputProps = {
    inputType: InputType;
    valueWcs: string;
    onChangeWcs: (val: string) => boolean; // return success or not for resetting displayed value
    disabled?: boolean;
    customPlaceholder?: string;
};

const WcsCoordNumericInput = ({inputType, valueWcs, onChangeWcs, disabled = false, customPlaceholder = ""}: WcsCoordNumericInputProps) => {
    const handleChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        if (!valueWcs) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === valueWcs) {
            return;
        }

        if (!onChangeWcs(wcsString)) {
            // reset displayed value if it's not updated successfully
            ev.currentTarget.value = valueWcs;
        }
    };

    let tooltipContent = "";
    switch (inputType) {
        case InputType.XCoord:
            const formatX = AppStore.Instance.overlayStore.numbers.formatTypeX;
            tooltipContent = `Format: ${NUMBER_FORMAT_LABEL.get(formatX)}`;
            break;
        case InputType.YCoord:
            const formatY = AppStore.Instance.overlayStore.numbers.formatTypeY;
            tooltipContent = `Format: ${NUMBER_FORMAT_LABEL.get(formatY)}`;
            break;
        case InputType.Size:
            tooltipContent = "Format: arcsec(\"), arcmin('), or degrees(deg)";
            break;
        default:
            break;
    }

    let placeholder = "";
    switch (inputType) {
        case InputType.XCoord:
            placeholder = "X WCS Coordinate";
            break;
        case InputType.YCoord:
            placeholder = "Y WCS Coordinate";
            break;
        default:
            break;
    }
    if (customPlaceholder) {
        placeholder = customPlaceholder;
    }

    return (
        <Tooltip2 content={tooltipContent} position={Position.BOTTOM} hoverOpenDelay={300}>
            <SafeNumericInput allowNumericCharactersOnly={false} buttonPosition="none" placeholder={placeholder} disabled={disabled} value={valueWcs ?? ""} onBlur={handleChange} onKeyDown={handleChange} />
        </Tooltip2>
    );
};

interface ImageCoordNumericInputProps {
    inputType?: InputType;
    value: number;
    onChange: (val: number) => boolean; // return success or not for resetting displayed value
    disabled?: boolean;
    customPlaceholder?: string;
}

export const ImageCoordNumericInput = ({inputType, value, onChange, disabled = false, customPlaceholder = ""}: ImageCoordNumericInputProps) => {
    const handleChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;

        if (!onChange(parseFloat(valueString))) {
            // reset displayed value if it's not updated successfully
            ev.currentTarget.value = value;
        }
    };

    let placeholder = "";
    switch (inputType) {
        case InputType.XCoord:
            placeholder = "X Coordinate";
            break;
        case InputType.YCoord:
            placeholder = "Y Coordinate";
            break;
        default:
            break;
    }
    if (customPlaceholder) {
        placeholder = customPlaceholder;
    }

    return <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder={placeholder} disabled={disabled} value={isFinite(value) ? value : ""} onBlur={handleChange} onKeyDown={handleChange} />;
};

interface CoordNumericInputProps {
    coord: CoordinateMode;
    inputType: InputType;
    value: number;
    onChange: (val: number) => boolean;
    valueWcs: string;
    onChangeWcs: (val: string) => boolean;
    disabled?: boolean;
    wcsDisabled?: boolean;
    customPlaceholder?: string;
}

export const CoordNumericInput = ({coord, inputType, value, onChange, valueWcs, onChangeWcs, disabled = false, wcsDisabled = false, customPlaceholder = ""}: CoordNumericInputProps) => {
    if (coord === CoordinateMode.Image) {
        return <ImageCoordNumericInput inputType={inputType} value={value} onChange={onChange} disabled={disabled} customPlaceholder={customPlaceholder} />;
    } else {
        return <WcsCoordNumericInput inputType={inputType} valueWcs={valueWcs} onChangeWcs={onChangeWcs} disabled={disabled || wcsDisabled} customPlaceholder={customPlaceholder} />;
    }
};
