import * as React from "react";
import * as _ from "lodash";
import {action} from "mobx";
import {observer} from "mobx-react";
import {makeObservable, observable} from "mobx";
import tinycolor from "tinycolor2";
import {SketchPicker, ColorResult, RGBColor} from "react-color";
import {Button, Popover, PopoverPosition} from "@blueprintjs/core";
import "./ColorPickerComponent.scss";

interface ColorPickerComponentProps {
    color: string | RGBColor;
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

    constructor(props: ColorPickerComponentProps) {
        super(props);
        makeObservable(this);
    }

    @action private handleColorClick = () => {
        this.displayColorPicker = true;
    };

    @action private handleColorClose = () => {
        this.displayColorPicker = false;
    };

    private handleColorChange = _.throttle((newColor: ColorResult) => {
        if (this.props.setColor) {
            this.props.setColor(newColor);
        }
    }, ColorPickerComponent.CHANGE_DELAY);

    public render() {
        let popoverClassName = "color-picker-popup";
        if (this.props.darkTheme) {
            popoverClassName += " bp3-dark";
        }
        const buttonColor = tinycolor(this.props.color).toString();
        return (
            <Popover isOpen={this.displayColorPicker} onClose={this.handleColorClose} position={PopoverPosition.RIGHT} popoverClassName={popoverClassName}>
                <Button onClick={this.handleColorClick} className="color-swatch-button" disabled={this.props.disabled}>
                    <div style={{backgroundColor: buttonColor}}/>
                </Button>
                <SketchPicker color={this.props.color} onChange={this.handleColorChange} disableAlpha={this.props.disableAlpha} presetColors={this.props.presetColors}/>
            </Popover>
        );
    }
}