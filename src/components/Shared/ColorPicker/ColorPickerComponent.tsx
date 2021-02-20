import * as React from "react";
import * as _ from "lodash";
import {action} from "mobx";
import {observer} from "mobx-react";
import {makeObservable, observable} from "mobx";
import tinycolor from "tinycolor2";
import {SketchPicker, ColorResult, RGBColor, CustomPicker} from "react-color";
import {Button, Popover, PopoverPosition, MenuItem, IPopoverProps} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {getColorForTheme} from "utilities";
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

export default CustomPicker(ColorPickerComponent);

interface ColorComponentProps {
    selectedColor: string;
    onItemSelect: (selected: string) => void;
}

const ColorSelect = Select.ofType<string>();
const COLOR_POPOVER_PROPS: Partial<IPopoverProps> = {minimal: true, position: "auto-end", popoverClassName: "colorselect"};

export const ColorComponent: React.FC<ColorComponentProps> = (props) => {
    const selectedColor = props.selectedColor;

    const renderColorBlock = (color: string) => {
        let className = "dropdown-color";
        return (
            <div className={className} style={{background: getColorForTheme(color)}}>&nbsp;</div>
        );
    };

    const renderColorSelectItem = (color: string, {handleClick, modifiers, query}) => {
        return (
            <MenuItem
                active={modifiers.active}
                disabled={modifiers.disabled}
                key={color}
                onClick={handleClick}
                text={renderColorBlock(color)}
            />
        );
    };

    return (
        <ColorSelect
            activeItem={selectedColor}
            onItemSelect={(color) => props.onItemSelect(color)}
            popoverProps={COLOR_POPOVER_PROPS}
            filterable={false}
            items={["auto-blue", "auto-green", "auto-red"]}
            itemRenderer={renderColorSelectItem}
        >
            <Button className="colorselect" text={renderColorBlock(selectedColor)} rightIcon="double-caret-vertical"/>
        </ColorSelect>
    );
};