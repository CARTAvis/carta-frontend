import * as React from "react";
import {SketchPicker} from "react-color";
import {Button, Classes, MenuItem, Popover, PopoverPosition, type PopoverProps} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
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
    isInverted: boolean;
    disabled?: boolean;
    onColormapSelect: (selected: string) => void;
    onCustomColorSelect?: (selected: string) => void;
    enableAdditionalColor?: boolean;
    selectedCustomColor?: string;
    customColorStart?: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const ColorMapSelect = Select<string>;
const colormapPopoverProps: Partial<PopoverProps> = {minimal: true, position: "auto-end", popoverClassName: "colormap-select-popover"};
const CUSTOM_COLOR_MAP_OPTIONS = [...COLOR_MAPS_SELECTED, ...COLOR_MAPS_MONO.keys(), RenderConfigStore.COLOR_MAPS_CUSTOM, RenderConfigStore.COLOR_MAPS_PANEL];

export const ColormapComponent: React.FC<ColormapComponentProps> = props => {
    const items = props.enableAdditionalColor ? CUSTOM_COLOR_MAP_OPTIONS : COLOR_MAPS_SELECTED;

    const renderColormapSelectItem = (colormap: string, {handleClick, modifiers, query}) => {
        const isDisableAlpha = true;
        const changeDelay = 100;

        if (!modifiers.matchesPredicate) {
            return null;
        }

        if (colormap === RenderConfigStore.COLOR_MAPS_PANEL) {
            const popoverClassName = classNames("color-picker-popup", {[Classes.DARK]: AppStore.Instance.isDarkTheme});

            const handleColorChange = _.throttle((color: any) => {
                props.onCustomColorSelect?.(color.hex);
                props.onColormapSelect(RenderConfigStore.COLOR_MAPS_CUSTOM);
            }, changeDelay);

            return (
                <div key={"custom-color"} className={"raster-custom-color"}>
                    <Popover position={PopoverPosition.LEFT} popoverClassName={popoverClassName} content={<SketchPicker color={props.selectedCustomColor} onChange={handleColorChange} isDisableAlpha={isDisableAlpha} />}>
                        <Button text={"Color panel"} className="raster-color-swatch-button" />
                    </Popover>
                </div>
            );
        } else {
            const colormapBlock = <ColormapBlock colormap={colormap} isInverted={props.isInverted} customColorStart={props.customColorStart} selectedCustomColor={props.selectedCustomColor} />;
            return <MenuItem active={modifiers.active} disabled={modifiers.disabled} label={colormap} key={colormap} onClick={handleClick} text="" icon={colormapBlock} />;
        }
    };

    const colormapBlock = <ColormapBlock colormap={props.selectedColormap} isInverted={props.isInverted} customColorStart={props.customColorStart} selectedCustomColor={props.selectedCustomColor} />;
    return (
        <ColorMapSelect disabled={props.disabled} activeItem={props.selectedColormap} popoverProps={colormapPopoverProps} filterable={false} items={items} onItemSelect={props.onColormapSelect} itemRenderer={renderColormapSelectItem}>
            <Button disabled={props.disabled} text={colormapBlock} rightIcon="double-caret-vertical" alignText={"right"} data-testid="colormap-dropdown" />
        </ColorMapSelect>
    );
};

export const ColormapBlock = ({colormap, isInverted, isRoundIcon = false, customColorStart, selectedCustomColor}: {colormap: string; isInverted: boolean; isRoundIcon?: boolean; customColorStart?: string; selectedCustomColor?: string}) => {
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
        const n = COLOR_MAPS_ALL.length - COLOR_MAPS_MONO.size;
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
                    backgroundSize: `100% calc(300% * ${n})`,
                    backgroundPosition: `0 calc(300% * -${i} - ${blockHeight}px)`
                }}
            />
        );
    }
};
