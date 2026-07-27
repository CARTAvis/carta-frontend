import * as React from "react";
import {Button} from "@blueprintjs/core";
import type {ColorResult, RgbaColor} from "@uiw/react-color";
import classNames from "classnames";
import * as _ from "lodash";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import tinycolor from "tinycolor2";

import {ColorPickerPopover} from "./ColorPickerPopover";

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
            this.props.setColor(newColor);
        }
    }, ColorPickerComponent.ChangeDelay);

    public render() {
        const buttonColor = tinycolor(this.props.color);

        return (
            <ColorPickerPopover
                color={this.props.color}
                presetColors={this.props.presetColors}
                darkTheme={this.props.darkTheme}
                disableAlpha={this.props.disableAlpha}
                onChange={this.handleColorChange}
                isOpen={this.shouldDisplayColorPicker}
                onClose={this.handleColorClose}
                placement="right"
            >
                <Button onClick={this.handleColorClick} className="color-swatch-button" disabled={this.props.disabled}>
                    <div className={classNames({"transparent-color": buttonColor.getAlpha() === 0})} style={{backgroundColor: buttonColor.toString()}} />
                </Button>
            </ColorPickerPopover>
        );
    }
}
