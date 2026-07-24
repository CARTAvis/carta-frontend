import * as React from "react";
import {Button, Classes, MenuItem, PopoverNext} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {type ColorResult, Sketch} from "@uiw/react-color";
import classNames from "classnames";
import * as _ from "lodash";
import {makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {AppStore} from "stores";
import {AUTO_COLOR_OPTIONS, getColorForTheme, TRANSPARENT_COLOR} from "utilities";

import "./AutoColorPickerComponent.scss";

interface AutoColorPickerComponentProps {
    color: string;
    presetColors: string[];
    disableAlpha: boolean;
    disabled?: boolean;
    setColor: (color: string) => void;
}
// eslint-disable-next-line @typescript-eslint/naming-convention
const ColorSelect = Select<string>;
const CUSTOM_COLOR_OPTION = "custom-color";

@observer
export class AutoColorPickerComponent extends React.Component<AutoColorPickerComponentProps> {
    private static readonly ChangeDelay = 100;
    @observable shouldDisplayColorPicker: boolean = false;

    get autoColor(): string {
        return getColorForTheme(this.props.color);
    }

    private handleColorChange = _.throttle((newColor: ColorResult) => {
        if (this.props.setColor) {
            this.props.setColor(newColor.rgba.a === 0 ? "transparent" : newColor.hex);
        }
    }, AutoColorPickerComponent.ChangeDelay);

    private get presetColors() {
        return this.props.presetColors.map(color => (color === "transparent" ? TRANSPARENT_COLOR : color));
    }

    private renderColorBlock = (color: string) => {
        const className = "dropdown-color";
        return (
            <div className={className} style={{backgroundColor: color, opacity: this.props.disabled ? 0.5 : 1}}>
                &nbsp;
            </div>
        );
    };

    private renderColorSelectItem = (colorItem: string, {handleClick, modifiers}) => {
        if (colorItem === CUSTOM_COLOR_OPTION) {
            const popoverClassName = classNames("color-picker-popup", {[Classes.DARK]: AppStore.Instance.isDarkTheme});

            return (
                <div key={"custom-color"} className={"custom-color"}>
                    <PopoverNext
                        placement="bottom-end"
                        shouldReturnFocusOnClose={false}
                        popoverClassName={popoverClassName}
                        content={<Sketch color={this.autoColor === "transparent" ? TRANSPARENT_COLOR : this.autoColor} onChange={this.handleColorChange} disableAlpha={this.props.disableAlpha} presetColors={this.presetColors} />}
                    >
                        <Button text={"Other"} className="color-swatch-button" disabled={this.props.disabled} />
                    </PopoverNext>
                </div>
            );
        } else {
            return <MenuItem active={modifiers.active} disabled={modifiers.disabled} key={colorItem} onClick={handleClick} text={this.renderColorBlock(getColorForTheme(colorItem))} />;
        }
    };

    constructor(props: AutoColorPickerComponentProps) {
        super(props);
        makeObservable(this);
    }

    public render() {
        const color = this.props.color;

        return (
            <ColorSelect
                activeItem={color}
                onItemSelect={color => this.props.setColor(color)}
                popoverProps={{minimal: true, popoverClassName: "colorselect"}}
                filterable={false}
                items={[...AUTO_COLOR_OPTIONS, CUSTOM_COLOR_OPTION]}
                itemRenderer={this.renderColorSelectItem}
                disabled={this.props.disabled}
            >
                <Button className="colorselect" text={this.renderColorBlock(this.autoColor)} endIcon="double-caret-vertical" disabled={this.props.disabled} />
            </ColorSelect>
        );
    }
}
