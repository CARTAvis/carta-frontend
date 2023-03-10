import * as React from "react";
import {ColorResult, SketchPicker} from "react-color";
import {Button, PopoverPosition} from "@blueprintjs/core";
import {MenuItem2, Popover2} from "@blueprintjs/popover2";
import {Select2} from "@blueprintjs/select";
import classNames from "classnames";
import * as _ from "lodash";
import {computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {AppStore} from "stores";
import {AUTO_COLOR_OPTIONS, getColorForTheme} from "utilities";

import "./AutoColorPickerComponent.scss";

interface AutoColorPickerComponentProps {
    color: string;
    presetColors: string[];
    disableAlpha: boolean;
    disabled?: boolean;
    setColor: (color: string) => void;
}

const ColorSelect = Select2.ofType<string>();
const CUSTOM_COLOR_OPTION = "custom-color";

@observer
export class AutoColorPickerComponent extends React.Component<AutoColorPickerComponentProps> {
    private static readonly CHANGE_DELAY = 100;
    @observable displayColorPicker: boolean;

    @computed get autoColor(): string {
        return getColorForTheme(this.props.color);
    }

    private handleColorChange = _.throttle((newColor: ColorResult) => {
        if (this.props.setColor) {
            this.props.setColor(newColor.hex);
        }
    }, AutoColorPickerComponent.CHANGE_DELAY);

    private renderColorBlock = (color: string) => {
        let className = "dropdown-color";
        return (
            <div className={className} style={{backgroundColor: color}}>
                &nbsp;
            </div>
        );
    };

    private renderColorSelectItem = (colorItem: string, {handleClick, modifiers}) => {
        if (colorItem === CUSTOM_COLOR_OPTION) {
            const popoverClassName = classNames("color-picker-popup", {"bp4-dark": AppStore.Instance.darkTheme});

            return (
                <div key={"custom-color"} className={"custom-color"}>
                    <Popover2
                        position={PopoverPosition.BOTTOM_RIGHT}
                        popoverClassName={popoverClassName}
                        content={<SketchPicker color={this.autoColor} onChange={this.handleColorChange} disableAlpha={this.props.disableAlpha} presetColors={this.props.presetColors} />}
                    >
                        <Button text={"Other"} className="color-swatch-button" disabled={this.props.disabled} />
                    </Popover2>
                </div>
            );
        } else {
            return <MenuItem2 active={modifiers.active} disabled={modifiers.disabled} key={colorItem} onClick={handleClick} text={this.renderColorBlock(getColorForTheme(colorItem))} />;
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
                <Button className="colorselect" text={this.renderColorBlock(this.autoColor)} rightIcon="double-caret-vertical" disabled={this.props.disabled} />
            </ColorSelect>
        );
    }
}
