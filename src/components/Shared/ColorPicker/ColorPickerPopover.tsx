import * as React from "react";
import {Classes, PopoverNext, type PopoverNextPlacement} from "@blueprintjs/core";
import type {ColorResult, RgbaColor} from "@uiw/react-color";
import Sketch from "@uiw/react-color-sketch";
import classNames from "classnames";
import tinycolor from "tinycolor2";

import {DEFAULT_COLOR, TRANSPARENT_COLOR} from "utilities";

import "./ColorPickerComponent.scss";

interface ColorPickerPopoverProps {
    color: string | RgbaColor;
    presetColors: string[];
    darkTheme: boolean;
    disableAlpha: boolean;
    onChange: (color: ColorResult) => void;
    children: React.ReactNode;
    placement: PopoverNextPlacement;
    isOpen?: boolean;
    onClose?: () => void;
}

export const ColorPickerPopover = (props: ColorPickerPopoverProps) => {
    const parsedColor = tinycolor(props.color);
    const pickerColor = parsedColor.isValid() ? parsedColor.toHex8String() : DEFAULT_COLOR;
    const popoverClassName = classNames("color-picker-popup", {[Classes.DARK]: props.darkTheme});
    const pickerPresetColors = props.presetColors.map(presetColor => (presetColor === "transparent" ? TRANSPARENT_COLOR : presetColor));

    return (
        <PopoverNext
            isOpen={props.isOpen}
            onClose={props.onClose}
            placement={props.placement}
            shouldReturnFocusOnClose={false}
            popoverClassName={popoverClassName}
            content={<Sketch color={pickerColor} onChange={props.onChange} disableAlpha={props.disableAlpha} presetColors={pickerPresetColors} />}
        >
            {props.children}
        </PopoverNext>
    );
};
