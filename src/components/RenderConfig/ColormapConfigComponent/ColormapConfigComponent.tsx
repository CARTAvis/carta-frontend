import * as React from "react";
import {observer} from "mobx-react";
import {Button, FormGroup, IPopoverProps, MenuItem, NumericInput} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {FrameScaling, RenderConfigStore} from "../../../stores/RenderConfigStore";

// Static assets
import allMaps from "../../../static/allmaps.png";
// Equation SVG images
import linearSvg from "../../../static/equations/linear.svg";
import logSvg from "../../../static/equations/log.svg";
import sqrtSvg from "../../../static/equations/sqrt.svg";
import squaredSvg from "../../../static/equations/squared.svg";
import gammaSvg from "../../../static/equations/gamma.svg";

const equationSVGMap = new Map([
    [FrameScaling.LINEAR, linearSvg],
    [FrameScaling.LOG, logSvg],
    [FrameScaling.SQRT, sqrtSvg],
    [FrameScaling.SQUARE, squaredSvg],
    [FrameScaling.GAMMA, gammaSvg]
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
    handleColorMapChange = (newColorMap: string) => {
        this.props.renderConfig.setColorMap(newColorMap);
    };

    handleScalingChange = (scaling: FrameScaling) => {
        this.props.renderConfig.setScaling(scaling);
    };

    handleBiasChange = (value: number) => {
        this.props.renderConfig.bias = value;
    };

    handleContrastChange = (value: number) => {
        this.props.renderConfig.contrast = value;
    };

    handleGammaChange = (value: number) => {
        this.props.renderConfig.gamma = value;
    };

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
        const scalingName = RenderConfigStore.SCALING_TYPES.get(scaling);

        const equationDiv = (
            <div className="equation-div">
                <img src={equationSVGMap.get(scaling)}/>
            </div>
        );
        return (
            <MenuItem
                active={modifiers.active}
                disabled={modifiers.disabled}
                label={scalingName}
                key={scaling}
                onClick={handleClick}
                text={equationDiv}
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
                <FormGroup label={"Scaling type"} inline={true}>
                    <ScalingSelect
                        activeItem={renderConfig.scaling}
                        popoverProps={SCALING_POPOVER_PROPS}
                        filterable={false}
                        items={SCALING_KEYS}
                        onItemSelect={this.handleScalingChange}
                        itemRenderer={this.renderScalingSelectItem}
                    >
                        <Button text={renderConfig.scalingName} rightIcon="double-caret-vertical"/>
                    </ScalingSelect>
                </FormGroup>

                <FormGroup label={"Color map"} inline={true}>
                    <ColorMapSelect
                        activeItem={renderConfig.colorMapName}
                        popoverProps={COLORMAP_POPOVER_PROPS}
                        filterable={false}
                        items={RenderConfigStore.COLOR_MAPS_ALL}
                        onItemSelect={this.handleColorMapChange}
                        itemRenderer={this.renderColormapSelectItem}
                    >
                        <Button text={this.renderColormapBlock(renderConfig.colorMapName)} rightIcon="double-caret-vertical"/>
                    </ColorMapSelect>
                </FormGroup>
                <FormGroup label={"Bias"} inline={true}>
                    <NumericInput
                        style={{width: "60px"}}
                        min={-1}
                        max={1}
                        stepSize={0.1}
                        minorStepSize={0.01}
                        majorStepSize={0.5}
                        value={renderConfig.bias}
                        onValueChange={this.handleBiasChange}
                    />
                </FormGroup>
                <FormGroup label={"Contrast"} inline={true}>
                    <NumericInput
                        style={{width: "60px"}}
                        min={0}
                        max={5}
                        stepSize={0.1}
                        minorStepSize={0.01}
                        majorStepSize={0.5}
                        value={renderConfig.contrast}
                        onValueChange={this.handleContrastChange}
                    />
                </FormGroup>
                <FormGroup label={"Gamma"} inline={true}>
                    <NumericInput
                        style={{width: "60px"}}
                        min={0}
                        max={2}
                        stepSize={0.1}
                        minorStepSize={0.01}
                        majorStepSize={0.5}
                        value={renderConfig.gamma}
                        disabled={renderConfig.scaling !== FrameScaling.GAMMA}
                        onValueChange={this.handleGammaChange}
                    />
                </FormGroup>
            </React.Fragment>
        );
    }
}