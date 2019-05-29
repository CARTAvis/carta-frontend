import * as React from "react";
import * as AST from "ast_wrapper";
import {MenuItem, Button, IPopoverProps} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";

interface ColorComponentProps {
    selectedItem: string;
    onItemSelect: (selected: string) => void;
}

const ColorSelect = Select.ofType<string>();
const COLOR_POPOVER_PROPS: Partial<IPopoverProps> = {minimal: true, position: "auto-end", popoverClassName: "colorselect"};

export const ColorComponent: React.FC<ColorComponentProps> = (props) => {
    const renderColorBlock = (color: string) => {
        let className = "dropdown-color";
        
        return (
            <div
                className={className}
                style={{
                    background: color,
                }}
            >&nbsp;
            </div>
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
            activeItem={props.selectedItem}
            onItemSelect={props.onItemSelect}
            popoverProps={COLOR_POPOVER_PROPS}
            filterable={false}
            items={AST.colors}
            itemRenderer={renderColorSelectItem}
        >
            <Button className="colorselect" text={renderColorBlock(props.selectedItem)} rightIcon="double-caret-vertical"/>
        </ColorSelect>
    );
};
