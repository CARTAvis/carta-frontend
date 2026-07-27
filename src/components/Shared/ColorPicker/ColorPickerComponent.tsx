import * as React from "react";
import {Button, Classes, PopoverNext} from "@blueprintjs/core";
import type {ColorResult, RgbaColor} from "@uiw/react-color";
import Sketch from "@uiw/react-color-sketch";
import classNames from "classnames";
import * as _ from "lodash";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import tinycolor from "tinycolor2";

import {DEFAULT_COLOR, TRANSPARENT_COLOR} from "utilities";

import "./ColorPickerComponent.scss";

interface ColorPickerComponentProps {
    color: string | RgbaColor;
    presetColors: string[];
    darkTheme: boolean;
    disableAlpha: boolean;
    disabled?: boolean;
    setColor: (color: ColorResult) => void;
}
@observer
export class ColorPickerComponent extends React.Component<ColorPickerComponentProps> {
    private static readonly ChangeDelay = 100;

    @observable shouldDisplayColorPicker: boolean = false;

    constructor(props: ColorPickerComponentProps) {
        super(props);
        makeObservable(this);
    }

    @action private handleColorClick = () => {
        this.shouldDisplayColorPicker = true;
    };

    @action private handleColorClose = () => {
        this.shouldDisplayColorPicker = false;
    };

    private handleColorChange = _.throttle((newColor: ColorResult) => {
        if (this.props.setColor) {
            this.props.setColor(newColor.rgba.a === 0 ? {...newColor, hex: "transparent"} : newColor);
        }
    }, ColorPickerComponent.ChangeDelay);

    private get presetColors() {
        return this.props.presetColors.map(color => (color === "transparent" ? TRANSPARENT_COLOR : color));
    }

    private get pickerColor() {
        const color = tinycolor(this.props.color);
        return color.isValid() ? color.toHex8String() : DEFAULT_COLOR;
    }

    public render() {
        const popoverClassName = classNames("color-picker-popup", {[Classes.DARK]: this.props.darkTheme});
        const buttonColor = tinycolor(this.props.color);

        return (
            <PopoverNext
                isOpen={this.shouldDisplayColorPicker}
                onClose={this.handleColorClose}
                placement="right"
                shouldReturnFocusOnClose={false}
                popoverClassName={popoverClassName}
                content={<Sketch color={this.pickerColor} onChange={this.handleColorChange} disableAlpha={this.props.disableAlpha} presetColors={this.presetColors} />}
            >
                <Button onClick={this.handleColorClick} className="color-swatch-button" disabled={this.props.disabled}>
                    <div className={classNames({"transparent-color": buttonColor.getAlpha() === 0})} style={{backgroundColor: buttonColor.toString()}} />
                </Button>
            </PopoverNext>
        );
    }
}
