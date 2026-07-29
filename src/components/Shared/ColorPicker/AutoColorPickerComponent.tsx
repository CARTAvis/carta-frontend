import * as React from "react";
import {Button, MenuItem} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import type {ColorResult} from "@uiw/react-color";
import * as _ from "lodash";
import {observer} from "mobx-react";

import {AppStore} from "stores";
import {AUTO_COLOR_OPTIONS, getColorForTheme} from "utilities";

import {ColorPickerPopover} from "./ColorPickerPopover";

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

    get autoColor(): string {
        return getColorForTheme(this.props.color);
    }

    private handleColorChange = _.throttle((newColor: ColorResult) => {
        if (this.props.setColor) {
            this.props.setColor(newColor.rgba.a === 0 ? "transparent" : newColor.hex);
        }
    }, AutoColorPickerComponent.ChangeDelay);

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
            return (
                <div key={"custom-color"} className={"custom-color"}>
                    <ColorPickerPopover color={this.autoColor} presetColors={this.props.presetColors} darkTheme={AppStore.Instance.isDarkTheme} disableAlpha={this.props.disableAlpha} onChange={this.handleColorChange} placement="bottom-end">
                        <Button text={"Other"} className="color-swatch-button" disabled={this.props.disabled} />
                    </ColorPickerPopover>
                </div>
            );
        } else {
            return <MenuItem active={modifiers.active} disabled={modifiers.disabled} key={colorItem} onClick={handleClick} text={this.renderColorBlock(getColorForTheme(colorItem))} />;
        }
    };

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
