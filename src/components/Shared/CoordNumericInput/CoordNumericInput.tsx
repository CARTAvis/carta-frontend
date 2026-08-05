import {Position, Tooltip} from "@blueprintjs/core";

import {CoordinateMode, InputType} from "enums";
import {AppStore} from "stores";
import {NUMBER_FORMAT_LABEL} from "utilities";

import {SafeNumericInput} from "..";

type WcsCoordNumericInputProps = {
    inputType: InputType;
    valueWcs: string | null;
    onChangeWcs: (val: string) => boolean; // return success or not for resetting displayed value
    disabled?: boolean;
    customPlaceholder?: string;
};

const WcsCoordNumericInput = ({inputType, valueWcs, onChangeWcs, disabled: isDisabled = false, customPlaceholder = ""}: WcsCoordNumericInputProps) => {
    const handleChange = ev => {
        if (ev.type === "keydown" && ev.key !== "Enter") {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (valueWcs && wcsString === valueWcs) {
            return;
        }

        if (!onChangeWcs(wcsString)) {
            // reset displayed value if it's not updated successfully
            ev.currentTarget.value = valueWcs;
        }
    };

    let tooltipContent = "";
    switch (valueWcs && inputType) {
        case InputType.XCoord:
            const formatX = AppStore.Instance.overlaySettings.numbers.formatTypeX;
            const formatXLabel = formatX ? NUMBER_FORMAT_LABEL.get(formatX) : undefined;
            tooltipContent = `Format: ${formatXLabel ?? "Unknown"}`;
            break;
        case InputType.YCoord:
            const formatY = AppStore.Instance.overlaySettings.numbers.formatTypeY;
            const formatYLabel = formatY ? NUMBER_FORMAT_LABEL.get(formatY) : undefined;
            tooltipContent = `Format: ${formatYLabel ?? "Unknown"}`;
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
            placeholder = "X WCS coordinate";
            break;
        case InputType.YCoord:
            placeholder = "Y WCS coordinate";
            break;
        default:
            break;
    }
    if (customPlaceholder) {
        placeholder = customPlaceholder;
    }

    return (
        <Tooltip content={tooltipContent} position={Position.BOTTOM} hoverOpenDelay={300}>
            <SafeNumericInput allowNumericCharactersOnly={false} buttonPosition="none" placeholder={placeholder} disabled={isDisabled} value={valueWcs ?? ""} onBlur={handleChange} onKeyDown={handleChange} />
        </Tooltip>
    );
};

interface ImageCoordNumericInputProps {
    inputType?: InputType;
    value: number;
    onChange: (val: number) => boolean; // return success or not for resetting displayed value
    disabled?: boolean;
    customPlaceholder?: string;
}

export const ImageCoordNumericInput = ({inputType, value, onChange, disabled: isDisabled = false, customPlaceholder = ""}: ImageCoordNumericInputProps) => {
    const handleChange = ev => {
        if (ev.type === "keydown" && ev.key !== "Enter") {
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

    return <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder={placeholder} disabled={isDisabled} value={isFinite(value) ? value : ""} onBlur={handleChange} onKeyDown={handleChange} />;
};

interface CoordNumericInputProps {
    coord: CoordinateMode;
    inputType: InputType;
    value: number;
    onChange: (val: number) => boolean;
    valueWcs: string | null;
    onChangeWcs: (val: string) => boolean;
    disabled?: boolean;
    wcsDisabled?: boolean;
    customPlaceholder?: string;
}

export const CoordNumericInput = ({coord, inputType, value, onChange, valueWcs, onChangeWcs, disabled: isDisabled = false, wcsDisabled: isWcsDisabled = false, customPlaceholder = ""}: CoordNumericInputProps) => {
    const isImgCoordinates = AppStore.Instance.overlaySettings.isImgCoordinates;
    if (coord === CoordinateMode.Image) {
        return <ImageCoordNumericInput inputType={inputType} value={value} onChange={onChange} disabled={isDisabled} customPlaceholder={customPlaceholder} />;
    } else {
        return <WcsCoordNumericInput inputType={inputType} valueWcs={isImgCoordinates ? "" : valueWcs} onChangeWcs={onChangeWcs} disabled={isDisabled || isWcsDisabled || isImgCoordinates} customPlaceholder={customPlaceholder} />;
    }
};
