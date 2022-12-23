import {Position} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {AppStore, NUMBER_FORMAT_LABEL} from "stores";
import {RegionCoordinate} from "stores/Frame";
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
    disabled: boolean;
    sizePlaceholder?: string;
};

const WcsCoordNumericInput = ({inputType, valueWcs, onChangeWcs, disabled, sizePlaceholder = ""}: WcsCoordNumericInputProps) => {
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
        case InputType.Size:
            placeholder = sizePlaceholder ?? "";
            break;
        default:
            break;
    }

    return (
        <Tooltip2 content={tooltipContent} position={Position.BOTTOM} hoverOpenDelay={300}>
            <SafeNumericInput allowNumericCharactersOnly={false} buttonPosition="none" placeholder={placeholder} disabled={disabled} value={valueWcs ?? ""} onBlur={handleChange} onKeyDown={handleChange} />
        </Tooltip2>
    );
};

type ImageCoordNumericInputProps = {
    inputType: InputType;
    value: number;
    onChange: (val: string) => boolean; // return success or not for resetting displayed value
    sizePlaceholder?: string;
};

const ImageCoordNumericInput = ({inputType, value, onChange, sizePlaceholder = ""}: ImageCoordNumericInputProps) => {
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

    let placeholder = "";
    switch (inputType) {
        case InputType.XCoord:
            placeholder = "X Coordinate";
            break;
        case InputType.YCoord:
            placeholder = "Y Coordinate";
            break;
        case InputType.Size:
            placeholder = sizePlaceholder ?? "";
            break;
        default:
            break;
    }

    return <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder={placeholder} value={value} onBlur={handleChange} onKeyDown={handleChange} />;
};

interface CoordNumericInputProps {
    coord: RegionCoordinate;
    inputType: InputType;
    value: number;
    onChange: (val: string) => boolean;
    valueWcs: string;
    onChangeWcs: (val: string) => boolean;
    wcsDisabled: boolean;
    sizePlaceholder?: string;
}

export const CoordNumericInput = ({coord, inputType, value, onChange, valueWcs, onChangeWcs, wcsDisabled, sizePlaceholder = ""}: CoordNumericInputProps) => {
    if (coord === RegionCoordinate.Image) {
        return <ImageCoordNumericInput inputType={inputType} value={value} onChange={onChange} sizePlaceholder={sizePlaceholder} />;
    } else {
        return <WcsCoordNumericInput inputType={inputType} valueWcs={valueWcs} onChangeWcs={onChangeWcs} disabled={wcsDisabled} sizePlaceholder={sizePlaceholder} />;
    }
};
