import * as React from "react";
import * as _ from "lodash";
import {observer} from "mobx-react";
import {observable} from "mobx";
import {SketchPicker, ColorResult} from "react-color";
import {AnchorButton, Popover, PopoverPosition} from "@blueprintjs/core";
import "./ColorPickerComponent.css";

interface ColorPickerComponentProps {
    color: string;
    presetColors: string[];
    darkTheme: boolean;
    disableAlpha: boolean;
    setColor: (color: string) => void;
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
            this.props.setColor(newColor.hex);
        }
    }, ColorPickerComponent.CHANGE_DELAY);

    public render() {
        let popoverClassName = "color-picker-popup";
        if (this.props.darkTheme) {
            popoverClassName += " bp3-dark";
        }

        return (
            <Popover isOpen={this.displayColorPicker} onClose={this.handleColorClose} position={PopoverPosition.RIGHT} popoverClassName={popoverClassName}>
                <AnchorButton onClick={this.handleColorClick} className="color-swatch-button">
                        <div style={{backgroundColor: this.props.color}}/>
                </AnchorButton>
                <SketchPicker color={this.props.color} onChange={this.handleColorChange} disableAlpha={this.props.disableAlpha} presetColors={this.props.presetColors}/>
            </Popover>
        );
    }
}
