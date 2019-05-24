import * as React from "react";
import {MenuItem, IPopoverProps, Button} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {FrameScaling, RenderConfigStore} from "stores/RenderConfigStore";

// Equation PNG images
import linearPng from "static/equations/linear.png";
import logPng from "static/equations/log.png";
import sqrtPng from "static/equations/sqrt.png";
import squaredPng from "static/equations/squared.png";
import gammaPng from "static/equations/gamma.png";
import powerPng from "static/equations/power.png";

const equationPngMap = new Map([
    [FrameScaling.LINEAR, linearPng],
    [FrameScaling.LOG, logPng],
    [FrameScaling.SQRT, sqrtPng],
    [FrameScaling.SQUARE, squaredPng],
    [FrameScaling.GAMMA, gammaPng],
    [FrameScaling.POWER, powerPng]
]);

const ScalingSelect = Select.ofType<FrameScaling>();
const SCALING_KEYS = Array.from(RenderConfigStore.SCALING_TYPES.keys());
const SCALING_POPOVER_PROPS: Partial<IPopoverProps> = {minimal: true, position: "auto-end", popoverClassName: "colormap-select-popover"};

export const ScalingComponent: React.FC = () => {
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
                text={<div className="equation-div" style={{backgroundImage: `url(${equationPngMap.get(scaling)}`}}/>}
            />
        );
    };

    return (
        <ScalingSelect
            activeItem={renderConfig.scaling}
            popoverProps={SCALING_POPOVER_PROPS}
            filterable={false}
            items={SCALING_KEYS}
            onItemSelect={this.props.renderConfig.setScaling}
            itemRenderer={renderScalingSelectItem}
        >
            <Button text={renderConfig.scalingName} rightIcon="double-caret-vertical" alignText={"right"}/>
        </ScalingSelect>
    );
}