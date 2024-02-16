import * as React from "react";
import {SketchPicker} from "react-color";
import {Button, IPopoverProps, MenuItem, PopoverPosition} from "@blueprintjs/core";
import {Popover2} from "@blueprintjs/popover2";
import {Select} from "@blueprintjs/select";
import classNames from "classnames";
import * as _ from "lodash";
// Static assets
import allMaps from "static/allmaps.png";

import {AppStore, PreferenceKeys, PreferenceStore} from "stores";
import {RenderConfigStore} from "stores/Frame";

import "./ColormapComponent.scss";

interface ColormapComponentProps {
    selectedItem: string;
    inverted: boolean;
    disabled?: boolean;
    onItemSelect: (selected: string) => void;
    setPreference?: PreferenceKeys;
    items?: string[];
}

const ColorMapSelect = Select.ofType<string>();
const COLORMAP_POPOVER_PROPS: Partial<IPopoverProps> = {minimal: true, position: "auto-end", popoverClassName: "colormap-select-popover"};
const CUSTOM_COLOR_OPTION = "custom";
const PREFERENCE_KEY_PAIRS = new Map<PreferenceKeys, PreferenceKeys>([
    [PreferenceKeys?.RENDER_CONFIG_COLORHEX, PreferenceKeys?.RENDER_CONFIG_COLORMAP],
    [PreferenceKeys?.CONTOUR_CONFIG_COLORHEX, PreferenceKeys?.CONTOUR_CONFIG_COLORMAP],
    [PreferenceKeys?.VECTOR_OVERLAY_COLORHEX, PreferenceKeys?.VECTOR_OVERLAY_COLORMAP]
]);

export const ColormapComponent: React.FC<ColormapComponentProps> = props => {
    const renderColormapBlock = (colormap: string) => {
        const className = "colormap-block";
        const blockHeight = 15;

        if (colormap === CUSTOM_COLOR_OPTION) {
            const renderConfig = AppStore.Instance.activeFrame?.renderConfig;
            let customColorHex: string;
            if (props.setPreference === PreferenceKeys.NON_PREFERENCE) {
                customColorHex = renderConfig.customColorHex ? renderConfig.customColorHex : PreferenceStore.Instance.colormapHex;
            } else {
                customColorHex = PreferenceStore.Instance.colormapHex;
            }
            const customColorStarHex = PreferenceStore.Instance.colormapStartHex;

            return (
                <div
                    className={className}
                    style={{
                        transform: `scaleX(${props.inverted ? -1 : 1})`,
                        height: `${blockHeight}px`,
                        backgroundImage: `linear-gradient(to right, ${customColorStarHex}, ${customColorHex})`,
                        backgroundSize: `100% 300%`,
                        backgroundPosition: `0 calc(-300% - ${blockHeight}px)`
                    }}
                />
            );
        } else if (RenderConfigStore.COLOR_MAPS_CALCULATED.get(colormap)) {
            return (
                <div
                    className={className}
                    style={{
                        transform: `scaleX(${props.inverted ? -1 : 1})`,
                        height: `${blockHeight}px`,
                        backgroundImage: `linear-gradient(to right, black , ${RenderConfigStore.COLOR_MAPS_CALCULATED.get(colormap)})`,
                        backgroundSize: `100% 300%`,
                        backgroundPosition: `0 calc(-300% - ${blockHeight}px)`
                    }}
                />
            );
        } else {
            const N = RenderConfigStore.COLOR_MAPS_ALL.length - RenderConfigStore.COLOR_MAPS_CALCULATED.size - 1; // -1 is the custom color
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

    const [color, setColor] = React.useState<string>(PreferenceStore.Instance.colormapHex); // initial color is white

    const renderColormapSelectItem = (colormap: string, {handleClick, modifiers, query}) => {
        const disableAlpha = false;
        const changeDelay = 100;
        let presetColors: string[];
        const renderConfig = AppStore.Instance.activeFrame?.renderConfig;

        const handleColorChange = _.throttle((color: any) => {
            setColor(color.hex);
            if (props.setPreference === PreferenceKeys.NON_PREFERENCE) {
                renderConfig?.setCustomColorMap(color.hex, colormap);
            } else {
                PreferenceStore.Instance.setPreference(props.setPreference, color.hex);
                PreferenceStore.Instance.setPreference(PREFERENCE_KEY_PAIRS.get(props.setPreference), CUSTOM_COLOR_OPTION);
            }
        }, changeDelay);

        if (!modifiers.matchesPredicate) {
            return null;
        }
        if (colormap === "color_panel") {
            const popoverClassName = classNames("color-picker-popup", {"bp3-dark": AppStore.Instance.darkTheme});

            return (
                <div key={"custom-color"} className={"custom-color"}>
                    <Popover2 position={PopoverPosition.LEFT} popoverClassName={popoverClassName} content={<SketchPicker color={color} onChange={handleColorChange} disableAlpha={disableAlpha} presetColors={presetColors} />}>
                        <Button text={"color panel"} className="raster-color-swatch-button" />
                    </Popover2>
                </div>
            );
        } else {
            return <MenuItem active={modifiers.active} disabled={modifiers.disabled} label={colormap} key={colormap} onClick={handleClick} text={renderColormapBlock(colormap)} />;
        }
    };

    const items = props.items ? props.items : RenderConfigStore.COLOR_MAPS_SELECTED;

    return (
        <ColorMapSelect disabled={props.disabled} activeItem={props.selectedItem} popoverProps={COLORMAP_POPOVER_PROPS} filterable={false} items={items} onItemSelect={props.onItemSelect} itemRenderer={renderColormapSelectItem}>
            <Button disabled={props.disabled} text={renderColormapBlock(props.selectedItem)} rightIcon="double-caret-vertical" alignText={"right"} />
        </ColorMapSelect>
    );
};
