import * as React from "react";
import {Button, MenuItem, PopoverProps} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import gammaPng from "static/equations/gamma.png";
// Equation PNG images
import linearPng from "static/equations/linear.png";
import logPng from "static/equations/log.png";
import powerPng from "static/equations/power.png";
import sqrtPng from "static/equations/sqrt.png";
import squaredPng from "static/equations/squared.png";

import {FrameScaling, RenderConfigStore} from "stores/Frame";

import "./ScalingSelectComponent.scss";

interface ScalingComponentProps {
    selectedItem: FrameScaling;
    onItemSelect: (selected: FrameScaling) => void;
    disabled?: boolean;
}

const equationPngMap = new Map([
    [FrameScaling.LINEAR, linearPng],
    [FrameScaling.LOG, logPng],
    [FrameScaling.SQRT, sqrtPng],
    [FrameScaling.SQUARE, squaredPng],
    [FrameScaling.GAMMA, gammaPng],
    [FrameScaling.POWER, powerPng]
]);

const ScalingSelect = Select<FrameScaling>;
const SCALING_KEYS = Array.from(RenderConfigStore.SCALING_TYPES.keys());
export const SCALING_POPOVER_PROPS: Partial<PopoverProps> = {minimal: true, position: "auto-end", popoverClassName: "colormap-select-popover"};

export const ScalingSelectComponent: React.FC<ScalingComponentProps> = props => {
    const renderScalingSelectItem = (scaling: FrameScaling, {handleClick, modifiers, query}) => {
        if (!modifiers.matchesPredicate || !RenderConfigStore.SCALING_TYPES.has(scaling)) {
            return null;
        }
        return (
            <MenuItem
                active={modifiers.active}
                disabled={modifiers.disabled}
                label={RenderConfigStore.SCALING_TYPES.get(scaling)}
                key={scaling}
                onClick={handleClick}
                text={<div className="equation-div" style={{backgroundImage: `url(${equationPngMap.get(scaling)}`, backgroundSize: "contain"}} />}
                style={{width: "220px"}}
            />
        );
    };

    return (
        <ScalingSelect activeItem={props.selectedItem} onItemSelect={props.onItemSelect} popoverProps={SCALING_POPOVER_PROPS} filterable={false} items={SCALING_KEYS} itemRenderer={renderScalingSelectItem} disabled={props.disabled}>
            <Button text={RenderConfigStore.SCALING_TYPES.get(props.selectedItem)} rightIcon="double-caret-vertical" alignText={"right"} disabled={props.disabled} />
        </ScalingSelect>
    );
};
