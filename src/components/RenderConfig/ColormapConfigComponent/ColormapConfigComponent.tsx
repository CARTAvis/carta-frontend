import * as React from "react";
import {observer} from "mobx-react";
import {Button, FormGroup, IPopoverProps, MenuItem, NumericInput} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {FrameScaling, RenderConfigStore} from "../../../stores/RenderConfigStore";
// Static assets
import allMaps from "../../../static/allmaps.png";
// Equation PNG images
import linearPng from "../../../static/equations/linear.png";
import logPng from "../../../static/equations/log.png";
import sqrtPng from "../../../static/equations/sqrt.png";
import squaredPng from "../../../static/equations/squared.png";
import gammaPng from "../../../static/equations/gamma.png";
import powerPng from "../../../static/equations/power.png";

const equationPngMap = new Map([
    [FrameScaling.LINEAR, linearPng],
    [FrameScaling.LOG, logPng],
    [FrameScaling.SQRT, sqrtPng],
    [FrameScaling.SQUARE, squaredPng],
    [FrameScaling.GAMMA, gammaPng],
    [FrameScaling.POWER, powerPng]
]);

const ColorMapSelect = Select.ofType<string>();
const ScalingSelect = Select.ofType<FrameScaling>();

interface ColormapConfigProps {
    renderConfig: RenderConfigStore;
    darkTheme: boolean;
}

const SCALING_KEYS = Array.from(RenderConfigStore.SCALING_TYPES.keys());
const SCALING_POPOVER_PROPS: Partial<IPopoverProps> = {minimal: true, position: "auto-end"};
const COLORMAP_POPOVER_PROPS: Partial<IPopoverProps> = {minimal: true, position: "auto-end", popoverClassName: "colormap-select-popover"};

@observer
export class ColormapConfigComponent extends React.Component<ColormapConfigProps> {
    renderColormapBlock = (colormap: string) => {
        let className = "colormap-block";
        if (this.props.darkTheme) {
            className += " bp3-dark";
        }
        const blockHeight = 15;
        const N = RenderConfigStore.COLOR_MAPS_ALL.length;
        const i = RenderConfigStore.COLOR_MAPS_ALL.indexOf(colormap);
        return (
            <div
                className={className}
                style={{
                    height: `${blockHeight}px`,
                    backgroundImage: `url(${allMaps})`,
                    backgroundSize: `100% calc(300% * ${N})`,
                    backgroundPosition: `0 calc(300% * -${i} - ${blockHeight}px)`,
                }}
            />

        );
    };

    renderColormapSelectItem = (colormap: string, {handleClick, modifiers, query}) => {
        if (!modifiers.matchesPredicate) {
            return null;
        }
        return (
            <MenuItem
                active={modifiers.active}
                disabled={modifiers.disabled}
                label={colormap}
                key={colormap}
                onClick={handleClick}
                text={this.renderColormapBlock(colormap)}
            />
        );
    };

    renderScalingSelectItem = (scaling: FrameScaling, {handleClick, modifiers, query}) => {
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

    render() {
        if (!this.props.renderConfig) {
            return null;
        }

        const renderConfig = this.props.renderConfig;
        return (
            <React.Fragment>
                <FormGroup label={"Scaling"} inline={true}>
                    <ScalingSelect
                        activeItem={renderConfig.scaling}
                        popoverProps={SCALING_POPOVER_PROPS}
                        filterable={false}
                        items={SCALING_KEYS}
                        onItemSelect={this.props.renderConfig.setScaling}
                        itemRenderer={this.renderScalingSelectItem}
                    >
                        <Button text={renderConfig.scalingName} rightIcon="double-caret-vertical" alignText={"right"}/>
                    </ScalingSelect>
                </FormGroup>

                <FormGroup label={"Color map"} inline={true}>
                    <ColorMapSelect
                        activeItem={renderConfig.colorMapName}
                        popoverProps={COLORMAP_POPOVER_PROPS}
                        filterable={false}
                        items={RenderConfigStore.COLOR_MAPS_ALL}
                        onItemSelect={this.props.renderConfig.setColorMap}
                        itemRenderer={this.renderColormapSelectItem}
                    >
                        <Button text={this.renderColormapBlock(renderConfig.colorMapName)} rightIcon="double-caret-vertical"/>
                    </ColorMapSelect>
                </FormGroup>
                {renderConfig.scaling === FrameScaling.GAMMA &&
                <FormGroup label={"Gamma"} inline={true}>
                    <NumericInput
                        min={0}
                        max={2}
                        stepSize={0.1}
                        minorStepSize={0.01}
                        majorStepSize={0.5}
                        value={renderConfig.gamma}
                        onValueChange={this.props.renderConfig.setGamma}
                    />
                </FormGroup>
                }
                {(renderConfig.scaling === FrameScaling.LOG || renderConfig.scaling === FrameScaling.POWER) &&
                <FormGroup label={"Alpha"} inline={true}>
                    <NumericInput
                        buttonPosition={"none"}
                        value={renderConfig.alpha}
                        onValueChange={this.props.renderConfig.setAlpha}
                    />
                </FormGroup>
                }
            </React.Fragment>
        );
    }
}