import * as React from "react";
import {MenuItem, IPopoverProps, Button} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {RenderConfigStore} from "stores/Frame";

// Static assets
import allMaps from "static/allmaps.png";

interface ColormapComponentProps {
    selectedItem: string;
    inverted: boolean;
    disabled?: boolean;
    onItemSelect: (selected: string) => void;
}

const ColorMapSelect = Select.ofType<string>();
const COLORMAP_POPOVER_PROPS: Partial<IPopoverProps> = {minimal: true, position: "auto-end", popoverClassName: "colormap-select-popover"};

export const ColormapComponent: React.FC<ColormapComponentProps> = props => {
    const renderColormapBlock = (colormap: string) => {
        let className = "colormap-block";
        const blockHeight = 15;
        const N = RenderConfigStore.COLOR_MAPS_ALL.length;
        const i = RenderConfigStore.COLOR_MAPS_ALL.indexOf(colormap);
        return (
            <div
                className={className}
                style={{
                    transform: `scaleX(${props.inverted ? -1 : 1})`,
                    height: `${blockHeight}px`,
                    backgroundImage: `url(${allMaps})`,
                    backgroundSize: `100% calc(300% * ${N})`,
                    backgroundPosition: `0 calc(300% * -${i} - ${blockHeight}px)`
                }}
            />
        );
    };

    const renderColormapSelectItem = (colormap: string, {handleClick, modifiers, query}) => {
        if (!modifiers.matchesPredicate) {
            return null;
        }
        return <MenuItem active={modifiers.active} disabled={modifiers.disabled} label={colormap} key={colormap} onClick={handleClick} text={renderColormapBlock(colormap)} />;
    };

    return (
        <ColorMapSelect
            disabled={props.disabled}
            activeItem={props.selectedItem}
            popoverProps={COLORMAP_POPOVER_PROPS}
            filterable={false}
            items={RenderConfigStore.COLOR_MAPS_SELECTED}
            onItemSelect={props.onItemSelect}
            itemRenderer={renderColormapSelectItem}
        >
            <Button disabled={props.disabled} text={renderColormapBlock(props.selectedItem)} rightIcon="double-caret-vertical" alignText={"right"} />
        </ColorMapSelect>
    );
};
