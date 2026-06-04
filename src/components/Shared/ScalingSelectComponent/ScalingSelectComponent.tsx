import * as React from "react";
import {Button, MenuItem, type PopoverProps} from "@blueprintjs/core";
import {type ItemRenderer, Select} from "@blueprintjs/select";
// Equation PNG images
import asinhPng from "static/equations/asinh.png";
import gammaPng from "static/equations/gamma.png";
import linearPng from "static/equations/linear.png";
import logPng from "static/equations/log.png";
import powerPng from "static/equations/power.png";
import sinhPng from "static/equations/sinh.png";
import sqrtPng from "static/equations/sqrt.png";
import squaredPng from "static/equations/squared.png";

import {FrameScaling} from "enums";
import {RenderConfigStore} from "stores/Frame";

import "./ScalingSelectComponent.scss";

interface ScalingComponentProps {
    selectedItem: FrameScaling;
    onItemSelect: (selected: FrameScaling) => void;
    onItemHover?: (item: FrameScaling) => void;
    onDropdownOpenChange?: (isOpen: boolean) => void;
    disabled?: boolean;
}

const EQUATION_PNG_MAP = new Map([
    [FrameScaling.LINEAR, linearPng],
    [FrameScaling.LOG, logPng],
    [FrameScaling.SQRT, sqrtPng],
    [FrameScaling.SQUARE, squaredPng],
    [FrameScaling.GAMMA, gammaPng],
    [FrameScaling.POWER, powerPng],
    [FrameScaling.SINH, sinhPng],
    [FrameScaling.ASINH, asinhPng]
]);

// eslint-disable-next-line @typescript-eslint/naming-convention
const ScalingSelect = Select<FrameScaling>;
const SCALING_KEYS = Array.from(RenderConfigStore.SCALING_TYPES.keys());
export const SCALING_POPOVER_PROPS: Partial<PopoverProps> = {minimal: true, position: "auto-end", popoverClassName: "colormap-select-popover"};

export const ScalingSelectComponent: React.FC<ScalingComponentProps> = props => {
    const [activeItem, setActiveItem] = React.useState(props.selectedItem);
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);

    React.useEffect(() => {
        if (!isDropdownOpen) {
            setActiveItem(props.selectedItem);
        }
    }, [isDropdownOpen, props.selectedItem]);

    const handleActiveItemChange = (activeItem: FrameScaling | null) => {
        if (activeItem !== null) {
            setActiveItem(activeItem);
            props.onItemHover?.(activeItem);
        }
    };

    const handleScalingHover = (scaling: FrameScaling) => {
        if (activeItem !== scaling) {
            setActiveItem(scaling);
            props.onItemHover?.(scaling);
        }
    };

    const renderScalingSelectItem: ItemRenderer<FrameScaling> = (scaling, {handleClick, handleFocus, modifiers}) => {
        if (!modifiers.matchesPredicate || !RenderConfigStore.SCALING_TYPES.has(scaling)) {
            return null;
        }
        const equationImage = EQUATION_PNG_MAP.get(scaling);
        return (
            <MenuItem
                active={modifiers.active}
                disabled={modifiers.disabled}
                label={RenderConfigStore.SCALING_TYPES.get(scaling)}
                key={scaling}
                onClick={handleClick}
                onFocus={handleFocus}
                onMouseEnter={() => handleScalingHover(scaling)}
                text={equationImage ? <div className="equation-div" style={{backgroundImage: `url(${equationImage})`, backgroundSize: "contain"}} /> : RenderConfigStore.SCALING_TYPES.get(scaling)}
                style={{width: "320px"}}
            />
        );
    };

    const popoverProps = {
        ...SCALING_POPOVER_PROPS,
        onInteraction: (isOpen: boolean) => {
            setIsDropdownOpen(isOpen);
            if (isOpen) {
                setActiveItem(props.selectedItem);
            }
            props.onDropdownOpenChange?.(isOpen);
        }
    };

    return (
        <ScalingSelect
            activeItem={activeItem}
            onItemSelect={props.onItemSelect}
            onActiveItemChange={handleActiveItemChange}
            popoverProps={popoverProps}
            filterable={false}
            items={SCALING_KEYS}
            itemRenderer={renderScalingSelectItem}
            disabled={props.disabled}
        >
            <Button text={RenderConfigStore.SCALING_TYPES.get(props.selectedItem)} rightIcon="double-caret-vertical" alignText={"right"} disabled={props.disabled} />
        </ScalingSelect>
    );
};
