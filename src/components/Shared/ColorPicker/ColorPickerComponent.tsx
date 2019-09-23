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
    setColor: (color: ColorResult) => void;
}

@observer
export class ColorPickerComponent extends React.Component<ColorPickerComponentProps> {
    @observable displayColorPicker: boolean;

    private handleColorClick = () => {
        this.displayColorPicker = true;
    };

    private handleColorClose = () => {
        this.displayColorPicker = false;
    };

    private handleColorChange = (newColor: ColorResult) => {
        if (this.props.setColor) {
            this.props.setColor(newColor);
        }
    };

    public render() {
        let popoverClassName = "color-picker-popup";
        if (this.props.darkTheme) {
            popoverClassName += " bp3-dark";
        }
        const buttonColor = typeof this.props.color === "string" ? this.props.color : `rgba(${ this.props.color.r }, ${ this.props.color.g }, ${ this.props.color.b }, ${ this.props.color.a })`;

        return (
            <Popover isOpen={this.displayColorPicker} onClose={this.handleColorClose} position={PopoverPosition.RIGHT} popoverClassName={popoverClassName}>
                <AnchorButton onClick={this.handleColorClick} className="color-swatch-button">
                        <div style={{backgroundColor: buttonColor}}/>
                </AnchorButton>
                <SketchPicker color={this.props.color} onChange={this.handleColorChange} disableAlpha={this.props.disableAlpha} presetColors={this.props.presetColors}/>
            </Popover>
        );
    }
}
