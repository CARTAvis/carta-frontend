import * as React from "react";
import {ColorResult, RGBColor,SketchPicker} from "react-color";
import {Button, PopoverPosition} from "@blueprintjs/core";
import {Popover2} from "@blueprintjs/popover2";
import classNames from "classnames";
import * as _ from "lodash";
import {action,makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import tinycolor from "tinycolor2";

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
        let popoverClassName = classNames("color-picker-popup", {"bp3-dark": this.props.darkTheme});
        const buttonColor = tinycolor(this.props.color).toString();

        return (
            <Popover2
                isOpen={this.displayColorPicker}
                onClose={this.handleColorClose}
                position={PopoverPosition.RIGHT}
                popoverClassName={popoverClassName}
                content={<SketchPicker color={this.props.color} onChange={this.handleColorChange} disableAlpha={this.props.disableAlpha} presetColors={this.props.presetColors} />}
            >
                <Button onClick={this.handleColorClick} className="color-swatch-button" disabled={this.props.disabled}>
                    <div style={{backgroundColor: buttonColor}} />
                </Button>
            </Popover2>
        );
    }
}
