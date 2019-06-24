import * as React from "react";
import * as AST from "ast_wrapper";
import {MenuItem, Button, IPopoverProps} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";

interface ColorComponentProps {
    selectedItem: number;
    onItemSelect: (selected: number) => void;
}

const AST_DEFAULT_COLOR = 4; // blue
const ColorSelect = Select.ofType<string>();
const COLOR_POPOVER_PROPS: Partial<IPopoverProps> = {minimal: true, position: "auto-end", popoverClassName: "colorselect"};

export const ColorComponent: React.FC<ColorComponentProps> = (props) => {
    const selectedColor = (props.selectedItem >= 0 && props.selectedItem < AST.colors.length) ? props.selectedItem : AST_DEFAULT_COLOR;

    const renderColorBlock = (color: string) => {
        let className = "dropdown-color";
        return (
            <div className={className} style={{background: color}}>&nbsp;</div>
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
            activeItem={AST.colors[selectedColor]}
            onItemSelect={(color) => props.onItemSelect(AST.colors.indexOf(color))}
            popoverProps={COLOR_POPOVER_PROPS}
            filterable={false}
            items={AST.colors}
            itemRenderer={renderColorSelectItem}
        >
            <Button className="colorselect" text={renderColorBlock(AST.colors[selectedColor])} rightIcon="double-caret-vertical"/>
        </ColorSelect>
    );
};
