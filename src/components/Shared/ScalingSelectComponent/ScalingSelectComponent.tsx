import * as React from "react";
import {MenuItem, IPopoverProps, Button} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {AppStore} from "stores";
import {FrameScaling, RenderConfigStore} from "stores/RenderConfigStore";

// Equation PNG images
import linearPng from "static/equations/linear.png";
import logPng from "static/equations/log.png";
import sqrtPng from "static/equations/sqrt.png";
import squaredPng from "static/equations/squared.png";
import gammaPng from "static/equations/gamma.png";
import powerPng from "static/equations/power.png";

import linearDarkPng from "static/equations/linear_dark.png";
import logDarkPng from "static/equations/log_dark.png";
import sqrtDarkPng from "static/equations/sqrt_dark.png";
import squaredDarkPng from "static/equations/squared_dark.png";
import gammaDarkPng from "static/equations/gamma_dark.png";
import powerDarkPng from "static/equations/power_dark.png";

interface ScalingComponentProps {
    selectedItem: FrameScaling;
    onItemSelect: (selected: FrameScaling) => void;
}

const equationPngMap = new Map([
    [FrameScaling.LINEAR, linearPng],
    [FrameScaling.LOG, logPng],
    [FrameScaling.SQRT, sqrtPng],
    [FrameScaling.SQUARE, squaredPng],
    [FrameScaling.GAMMA, gammaPng],
    [FrameScaling.POWER, powerPng]
]);

const equationDarkPngMap = new Map([
    [FrameScaling.LINEAR, linearDarkPng],
    [FrameScaling.LOG, logDarkPng],
    [FrameScaling.SQRT, sqrtDarkPng],
    [FrameScaling.SQUARE, squaredDarkPng],
    [FrameScaling.GAMMA, gammaDarkPng],
    [FrameScaling.POWER, powerDarkPng]
]);

const ScalingSelect = Select.ofType<FrameScaling>();
const SCALING_KEYS = Array.from(RenderConfigStore.SCALING_TYPES.keys());
export const SCALING_POPOVER_PROPS: Partial<IPopoverProps> = {minimal: true, position: "auto-end", popoverClassName: "colormap-select-popover"};

export const ScalingSelectComponent: React.FC<ScalingComponentProps> = (props) => {
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
                text={<div className="equation-div" style={{backgroundImage: `url(${AppStore?.Instance?.darkTheme ? equationDarkPngMap.get(scaling) : equationPngMap.get(scaling)}`, backgroundSize: 'contain'}}/>}
                style={{width: "220px"}}
            />
        );
    };

    return (
        <ScalingSelect
            activeItem={props.selectedItem}
            onItemSelect={props.onItemSelect}
            popoverProps={SCALING_POPOVER_PROPS}
            filterable={false}
            items={SCALING_KEYS}
            itemRenderer={renderScalingSelectItem}
        >
            <Button text={RenderConfigStore.SCALING_TYPES.get(props.selectedItem)} rightIcon="double-caret-vertical" alignText={"right"}/>
        </ScalingSelect>
    );
};
