import * as React from "react";
import * as _ from "lodash";
import {observer} from "mobx-react";
import {observable} from "mobx";
import {SketchPicker, ColorResult} from "react-color";
import {AnchorButton, Popover, PopoverPosition} from "@blueprintjs/core";
import {RGBA} from "utilities";
import "./ColorPickerComponent.css";

interface ColorPickerComponentProps {
    color: string | RGBA;
    presetColors: string[];
    darkTheme: boolean;
    disableAlpha: boolean;
    disabled?: boolean;
    setColor: (color: ColorResult) => void;
}

@observer
export class ColorPickerComponent extends React.Component<ColorPickerComponentProps> {
    private static readonly CHANGE_DELAY = 100;

    @observable displayColorPicker: boolean;

    private handleColorClick = () => {
        this.displayColorPicker = true;
    };

    private handleColorClose = () => {
        this.displayColorPicker = false;
    };

    private handleColorChange = _.throttle((newColor: ColorResult) => {
        if (this.props.setColor) {
            this.props.setColor(newColor);
        }
    }, ColorPickerComponent.CHANGE_DELAY);

    public render() {
        const disabled = this.props.disabled || false;

        let popoverClassName = "color-picker-popup";
        if (this.props.darkTheme) {
            popoverClassName += " bp3-dark";
        }
        const buttonColor = typeof this.props.color === "string" ? this.props.color : `rgba(${ this.props.color.r }, ${ this.props.color.g }, ${ this.props.color.b }, ${ this.props.color.a })`;

        return (
            <Popover isOpen={this.displayColorPicker} onClose={this.handleColorClose} position={PopoverPosition.RIGHT} popoverClassName={popoverClassName} disabled={disabled}>
                <AnchorButton onClick={this.handleColorClick} className="color-swatch-button" disabled={disabled}>
                        <div style={{backgroundColor: buttonColor}}/>
                </AnchorButton>
                <SketchPicker color={this.props.color} onChange={this.handleColorChange} disableAlpha={this.props.disableAlpha} presetColors={this.props.presetColors}/>
            </Popover>
        );
    }
}
