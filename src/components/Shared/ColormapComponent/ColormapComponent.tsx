import * as React from "react";
import {Button, Classes, MenuItem, PopoverNext, type PopoverProps} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import Sketch from "@uiw/react-color-sketch";
import classNames from "classnames";
import * as _ from "lodash";
// Static assets
import allMaps from "static/allmaps.png";

import {AppStore} from "stores";
import {RenderConfigStore} from "stores/Frame";
import {COLOR_MAPS_ALL, COLOR_MAPS_MONO, COLOR_MAPS_SELECTED} from "utilities";

import "./ColormapComponent.scss";

interface ColormapComponentProps {
    selectedColormap: string;
    inverted: boolean;
    disabled?: boolean;
    onColormapSelect: (selected: string) => void;
    onCustomColorSelect?: (selected: string) => void;
    onCustomColorStartSelect?: (selected: string) => void;
    enableAdditionalColor?: boolean;
    selectedCustomColor?: string;
    customColorStart?: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const ColorMapSelect = Select<string>;
const COLORMAP_POPOVER_PROPS: Partial<PopoverProps> = {minimal: true, position: "auto-end", popoverClassName: "colormap-select-popover"};
const CUSTOM_COLOR_MAP_OPTIONS = [...COLOR_MAPS_SELECTED, ...COLOR_MAPS_MONO.keys(), RenderConfigStore.COLOR_MAPS_CUSTOM, RenderConfigStore.COLOR_MAPS_PANEL];

export const ColormapComponent: React.FC<ColormapComponentProps> = props => {
    const items = props.enableAdditionalColor ? CUSTOM_COLOR_MAP_OPTIONS : COLOR_MAPS_SELECTED;

    const renderColormapSelectItem = (colormap: string, {handleClick, modifiers, query}) => {
        const shouldDisableAlpha = true;
        const changeDelay = 100;

        if (!modifiers.matchesPredicate) {
            return null;
        }

        if (colormap === RenderConfigStore.COLOR_MAPS_PANEL) {
            const popoverClassName = classNames("color-picker-popup", {[Classes.DARK]: AppStore.Instance.isDarkTheme});

            // Keep this for future use if we want to allow users to select the start color of the custom colormap
            /*
            const handleStartColorChange = _.throttle((color: any) => {
                props.onCustomColorStartSelect?.(color.hex);
                props.onColormapSelect(RenderConfigStore.COLOR_MAPS_CUSTOM);
            }, changeDelay);
            */

            const handleEndColorChange = _.throttle((color: any) => {
                props.onCustomColorSelect?.(color.hex);
                props.onColormapSelect(RenderConfigStore.COLOR_MAPS_CUSTOM);
            }, changeDelay);

            return (
                <div key={"custom-color"} className={"raster-custom-color"}>
                    <PopoverNext placement="left" shouldReturnFocusOnClose={false} popoverClassName={popoverClassName} content={<Sketch color={props.selectedCustomColor} onChange={handleEndColorChange} disableAlpha={shouldDisableAlpha} />}>
                        <Button text={"Color panel"} className="raster-color-swatch-button" />
                    </PopoverNext>
                </div>
            );
        } else {
            const colormapBlock = <ColormapBlock colormap={colormap} inverted={props.inverted} customColorStart={props.customColorStart} selectedCustomColor={props.selectedCustomColor} />;
            return <MenuItem active={modifiers.active} disabled={modifiers.disabled} label={colormap} key={colormap} onClick={handleClick} text="" icon={colormapBlock} />;
        }
    };

    const colormapBlock = <ColormapBlock colormap={props.selectedColormap} inverted={props.inverted} customColorStart={props.customColorStart} selectedCustomColor={props.selectedCustomColor} />;
    return (
        <ColorMapSelect disabled={props.disabled} activeItem={props.selectedColormap} popoverProps={COLORMAP_POPOVER_PROPS} filterable={false} items={items} onItemSelect={props.onColormapSelect} itemRenderer={renderColormapSelectItem}>
            <Button disabled={props.disabled} text={colormapBlock} endIcon="double-caret-vertical" alignText={"right"} data-testid="colormap-dropdown" />
        </ColorMapSelect>
    );
};

export const ColormapBlock = ({
    colormap,
    inverted: isInverted,
    roundIcon: isRoundIcon = false,
    customColorStart,
    selectedCustomColor
}: {
    colormap: string;
    inverted: boolean;
    roundIcon?: boolean;
    customColorStart?: string;
    selectedCustomColor?: string;
}) => {
    const className = "colormap-block";
    const blockHeight = 15;

    if (colormap === RenderConfigStore.COLOR_MAPS_CUSTOM) {
        return (
            <div
                className={className}
                style={{
                    transform: `scaleX(${isInverted ? -1 : 1})`,
                    height: `${blockHeight}px`,
                    backgroundImage: `linear-gradient(to right, ${customColorStart}, ${selectedCustomColor})`,
                    backgroundSize: `100% 300%`,
                    backgroundPosition: `0 calc(-300% - ${blockHeight}px)`
                }}
            />
        );
    } else if (COLOR_MAPS_MONO.get(colormap)) {
        return (
            <div
                className={className}
                style={{
                    transform: `scaleX(${isInverted ? -1 : 1})`,
                    height: `${blockHeight}px`,
                    width: isRoundIcon ? `${blockHeight}px` : undefined,
                    borderRadius: isRoundIcon ? `100%` : undefined,
                    backgroundImage: `linear-gradient(to right, black, ${COLOR_MAPS_MONO.get(colormap)})`,
                    backgroundSize: `100% 300%`,
                    backgroundPosition: `0 calc(-300% - ${blockHeight}px)`
                }}
            />
        );
    } else {
        const N = COLOR_MAPS_ALL.length - COLOR_MAPS_MONO.size;
        const i = COLOR_MAPS_ALL.indexOf(colormap);
        return (
            <div
                className={className}
                style={{
                    transform: `scaleX(${isInverted ? -1 : 1})`,
                    height: `${blockHeight}px`,
                    width: isRoundIcon ? `${blockHeight}px` : undefined,
                    borderRadius: isRoundIcon ? `100%` : undefined,
                    backgroundImage: `url(${allMaps})`,
                    backgroundSize: `100% calc(300% * ${N})`,
                    backgroundPosition: `0 calc(300% * -${i} - ${blockHeight}px)`
                }}
            />
        );
    }
};
