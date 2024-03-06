import * as React from "react";
import {SketchPicker} from "react-color";
import {Button, IPopoverProps, MenuItem, PopoverPosition} from "@blueprintjs/core";
import {Popover2} from "@blueprintjs/popover2";
import {Select} from "@blueprintjs/select";
import classNames from "classnames";
import * as _ from "lodash";
// Static assets
import allMaps from "static/allmaps.png";

import {AppStore} from "stores";
import {RenderConfigStore} from "stores/Frame";

import "./ColormapComponent.scss";

interface ColormapComponentProps {
    selectedColormap: string;
    inverted: boolean;
    disabled?: boolean;
    onColormapSelect: (selected: string) => void;
    onCustomColorSelect?: (selected: string) => void;
    enableAdditionalColor?: boolean;
    selectedCustomColor?: string;
    customColorStart?: string;
}

const ColorMapSelect = Select.ofType<string>();
const COLORMAP_POPOVER_PROPS: Partial<IPopoverProps> = {minimal: true, position: "auto-end", popoverClassName: "colormap-select-popover"};
const CUSTOM_COLOR_MAP_OPTIONS = [...RenderConfigStore.COLOR_MAPS_SELECTED, ...RenderConfigStore.COLOR_MAPS_MONO.keys(), RenderConfigStore.COLOR_MAPS_CUSTOM, RenderConfigStore.COLOR_MAPS_PANEL];

export const ColormapComponent: React.FC<ColormapComponentProps> = props => {
    const items = props.enableAdditionalColor ? CUSTOM_COLOR_MAP_OPTIONS : RenderConfigStore.COLOR_MAPS_SELECTED;

    const renderColormapBlock = (colormap: string) => {
        const className = "colormap-block";
        const blockHeight = 15;

        if (colormap === RenderConfigStore.COLOR_MAPS_CUSTOM) {
            return (
                <div
                    className={className}
                    style={{
                        transform: `scaleX(${props.inverted ? -1 : 1})`,
                        height: `${blockHeight}px`,
                        backgroundImage: `linear-gradient(to right, ${props.customColorStart}, ${props.selectedCustomColor})`,
                        backgroundSize: `100% 300%`,
                        backgroundPosition: `0 calc(-300% - ${blockHeight}px)`
                    }}
                />
            );
        } else if (RenderConfigStore.COLOR_MAPS_MONO.get(colormap)) {
            return (
                <div
                    className={className}
                    style={{
                        transform: `scaleX(${props.inverted ? -1 : 1})`,
                        height: `${blockHeight}px`,
                        backgroundImage: `linear-gradient(to right, black, ${RenderConfigStore.COLOR_MAPS_MONO.get(colormap)})`,
                        backgroundSize: `100% 300%`,
                        backgroundPosition: `0 calc(-300% - ${blockHeight}px)`
                    }}
                />
            );
        } else {
            const N = RenderConfigStore.COLOR_MAPS_ALL.length - RenderConfigStore.COLOR_MAPS_MONO.size;
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
        }
    };

    const renderColormapSelectItem = (colormap: string, {handleClick, modifiers, query}) => {
        const disableAlpha = true;
        const changeDelay = 100;

        const handleColorChange = _.throttle((color: any) => {
            props.onCustomColorSelect(color.hex);
        }, changeDelay);

        if (!modifiers.matchesPredicate) {
            return null;
        }

        if (colormap === RenderConfigStore.COLOR_MAPS_PANEL) {
            const popoverClassName = classNames("color-picker-popup", {"bp3-dark": AppStore.Instance.darkTheme});

            return (
                <div key={"custom-color"} className={"raster-custom-color"}>
                    <Popover2 position={PopoverPosition.LEFT} popoverClassName={popoverClassName} content={<SketchPicker color={props.selectedCustomColor} onChange={handleColorChange} disableAlpha={disableAlpha} />}>
                        <Button text={"Color panel"} className="raster-color-swatch-button" />
                    </Popover2>
                </div>
            );
        } else {
            return <MenuItem active={modifiers.active} disabled={modifiers.disabled} label={colormap} key={colormap} onClick={handleClick} text={renderColormapBlock(colormap)} />;
        }
    };

    return (
        <ColorMapSelect disabled={props.disabled} activeItem={props.selectedColormap} popoverProps={COLORMAP_POPOVER_PROPS} filterable={false} items={items} onItemSelect={props.onColormapSelect} itemRenderer={renderColormapSelectItem}>
            <Button disabled={props.disabled} text={renderColormapBlock(props.selectedColormap)} rightIcon="double-caret-vertical" alignText={"right"} />
        </ColorMapSelect>
    );
};
