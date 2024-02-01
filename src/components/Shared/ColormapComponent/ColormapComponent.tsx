import * as React from "react";
import {SketchPicker} from "react-color";
import {Button, IPopoverProps, MenuItem, PopoverPosition} from "@blueprintjs/core";
import {Popover2} from "@blueprintjs/popover2";
import {Select} from "@blueprintjs/select";
import classNames from "classnames";
import * as _ from "lodash";
// Static assets
import allMaps from "static/allmaps.png";

import {TileWebGLService} from "services";
import {AppStore} from "stores";
import {RenderConfigStore} from "stores/Frame";

interface ColormapComponentProps {
    selectedItem: string;
    inverted: boolean;
    disabled?: boolean;
    onItemSelect: (selected: string) => void;
}

const ColorMapSelect = Select.ofType<string>();
const COLORMAP_POPOVER_PROPS: Partial<IPopoverProps> = {minimal: true, position: "auto-end", popoverClassName: "colormap-select-popover"};
// const CUSTOM_COLOR_OPTION = "custom-color";

export const ColormapComponent: React.FC<ColormapComponentProps> = props => {
    const renderColormapBlock = (colormap: string) => {
        let className = "colormap-block";
        const blockHeight = 15;

        if (RenderConfigStore?.COLOR_MAPS_CALCULATED.get(colormap)) {
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
            const N = RenderConfigStore.COLOR_MAPS_ALL.length - RenderConfigStore.COLOR_MAPS_CALCULATED.size;
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

    const [color, setColor] = React.useState<string>(RenderConfigStore.COLOR_MAPS_CALCULATED.get("custom_mono"));

    const renderColormapSelectItem = (colormap: string, {handleClick, modifiers, query}) => {
        const disableAlpha = false;
        const changeDelay = 100;
        let presetColors: string[];

        const handleColorChange = _.throttle((color: any) => {
            setColor(color.hex);
            RenderConfigStore.COLOR_MAPS_CALCULATED.set("custom_mono", color.hex);
            AppStore.Instance.activeFrame.renderConfig.setColorMap("custom_mono");
        }, changeDelay);

        if (!modifiers.matchesPredicate) {
            return null;
        }
        if (colormap === "custom_mono") {
            const popoverClassName = classNames("color-picker-popup", {"bp3-dark": AppStore.Instance.darkTheme});

            return (
                <div key={"custom-color"} className={"custom_mono"}>
                    <Popover2 position={PopoverPosition.AUTO} popoverClassName={popoverClassName} content={<SketchPicker color={color} onChange={handleColorChange} disableAlpha={disableAlpha} presetColors={presetColors} />}>
                        {/* <MenuItem active={modifiers.active} disabled={modifiers.disabled} label={colormap} key={colormap} shouldDismissPopover={false} text={renderColormapBlock(colormap)} />; */}
                        <Button text={"custom_mono"} className="color-swatch-button" />
                    </Popover2>
                </div>
            );
        } else {
            return <MenuItem active={modifiers.active} disabled={modifiers.disabled} label={colormap} key={colormap} onClick={handleClick} text={renderColormapBlock(colormap)} />;
        }
        // return <MenuItem active={modifiers.active} disabled={modifiers.disabled} label={colormap} key={colormap} onClick={handleClick} text={renderColormapBlock(colormap)} />;
    };

    return (
        <ColorMapSelect
            disabled={props.disabled}
            activeItem={props.selectedItem}
            popoverProps={COLORMAP_POPOVER_PROPS}
            filterable={false}
            items={RenderConfigStore.COLOR_MAPS_SELECTED}
            onItemSelect={props.onItemSelect}
            itemRenderer={renderColormapSelectItem}
        >
            <Button disabled={props.disabled} text={renderColormapBlock(props.selectedItem)} rightIcon="double-caret-vertical" alignText={"right"} />
        </ColorMapSelect>
    );
};
