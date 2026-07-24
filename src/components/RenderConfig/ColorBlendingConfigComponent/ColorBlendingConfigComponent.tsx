import {Button, ButtonGroup, Classes, FormGroup, H6, HTMLSelect, Menu, MenuItem, PopoverNext, Text, Tooltip} from "@blueprintjs/core";
import Alpha from "@uiw/react-color-alpha";
import classNames from "classnames";
import {observer} from "mobx-react";

import {ColormapBlock, ColormapComponent, SafeNumericInput} from "components/Shared";
import {ImageType} from "enums";
import {AppStore, ColorBlendingStore, type FrameStore} from "stores";

import "./ColorBlendingConfigComponent.scss";

export const ColorBlendingConfigComponent = observer(({widgetWidth}: {widgetWidth: number}) => {
    const image = AppStore.Instance.activeImage;
    if (image?.type !== ImageType.COLOR_BLENDING) {
        return null;
    }
    const colorBlendingStore = image.store;
    const matchedFrames = colorBlendingStore.baseFrame?.secondarySpatialImages ?? [];
    const unselectedFrames = matchedFrames.filter(f => !colorBlendingStore.selectedFrames.includes(f));

    const newFrameOptions = unselectedFrames.map((f, i) => <MenuItem text={f.filename} onClick={() => colorBlendingStore.addSelectedFrame(f)} key={i} />);
    const colormapSetOptions = Array.from(ColorBlendingStore.COLORMAP_SETS, ([set, colormapSetConfig]) => (
        <MenuItem
            text=""
            icon={
                colormapSetConfig.type === "gradient" ? (
                    <ColormapBlock colormap={colormapSetConfig.colormap} inverted={colormapSetConfig.inverted} />
                ) : (
                    <div className="colormap-set-blocks">
                        {colormapSetConfig.colormaps.map(x => (
                            <ColormapBlock colormap={x} inverted={false} roundIcon={true} key={x} />
                        ))}
                    </div>
                )
            }
            label={set}
            onClick={() => colorBlendingStore.applyColormapSet(set)}
            key={set}
        />
    ));

    const getSetFrameOptions = (frame: FrameStore): {value: number; label: string}[] => {
        return matchedFrames.filter(f => unselectedFrames.includes(f) || f === frame).map(f => ({value: f.id, label: f.filename}));
    };

    const setSelectedFrame = (index: number, fileId: number) => {
        const frame = AppStore.Instance.getFrame(fileId);
        if (frame) {
            colorBlendingStore.setSelectedFrame(index, frame);
        }
    };

    const getLayerSettings = (frame: FrameStore, alphaIndex: number) => {
        const renderConfig = frame.renderConfig;
        const alpha = colorBlendingStore.alpha[alphaIndex];
        const setAlpha = (val: number) => colorBlendingStore.setAlpha(alphaIndex, val);
        return (
            <>
                <Tooltip content="Raster scaling matching enabled" disabled={!frame.rasterScalingReference}>
                    <ColormapComponent
                        disabled={!!frame.rasterScalingReference}
                        inverted={renderConfig.isInverted}
                        selectedColormap={renderConfig.colorMap}
                        onColormapSelect={renderConfig.setColorMap}
                        enableAdditionalColor={true}
                        onCustomColorSelect={renderConfig.setCustomHexEnd}
                        selectedCustomColor={renderConfig.customColormapHexEnd}
                        customColorStart={renderConfig.customColormapHexStart}
                    />
                </Tooltip>
                <div className="alpha-settings">
                    <Alpha className="alpha-slider" hsva={{h: 0, s: 0, v: 0, a: alpha}} onChange={color => setAlpha(color.a)} />
                    <Tooltip content="Alpha">
                        <SafeNumericInput className="alpha-input" selectAllOnFocus={true} value={alpha} min={0} max={1} stepSize={0.1} onValueChange={val => setAlpha(val)} />
                    </Tooltip>
                    <Tooltip content="Remove layer" disabled={alphaIndex <= 0}>
                        <Button icon="small-cross" variant="minimal" style={{visibility: alphaIndex > 0 ? "visible" : "hidden"}} onClick={() => colorBlendingStore.deleteSelectedFrame(alphaIndex - 1)} />
                    </Tooltip>
                </div>
            </>
        );
    };

    const addLayerTooltip = (
        <span>
            Add a new layer with a spatially matched image
            <span>
                <br />
                <i>
                    <small>Include images as options by matching them spatially with the Image List widget.</small>
                </i>
            </span>
        </span>
    );
    const baseFrameTooltip = (
        <span>
            The spatial reference
            <span>
                <br />
                <i>
                    <small>Change the image by changing the spatial reference with the Image List widget.</small>
                </i>
            </span>
        </span>
    );
    const selectedFrameTooltip = (
        <span>
            A spatially matched image
            <span>
                <br />
                <i>
                    <small>Include images as options by matching them spatially with the Image List widget.</small>
                </i>
            </span>
        </span>
    );
    const buttonTextCutoff = 550;

    return (
        <div className={classNames("color-blending-config", {[Classes.DARK]: AppStore.Instance.isDarkTheme})}>
            <div className="heading">
                <H6>Color blending configuration</H6>
                <ButtonGroup>
                    <PopoverNext animation="minimal" arrow={false} shouldReturnFocusOnClose={false} content={<Menu>{newFrameOptions}</Menu>}>
                        <Tooltip content={addLayerTooltip}>
                            <Button icon="add" endIcon="caret-down" disabled={!newFrameOptions.length}>
                                {widgetWidth < buttonTextCutoff ? "" : "Add layer"}
                            </Button>
                        </Tooltip>
                    </PopoverNext>
                    <PopoverNext animation="minimal" arrow={false} shouldReturnFocusOnClose={false} content={<Menu>{colormapSetOptions}</Menu>}>
                        <Button icon="color-fill" endIcon="caret-down">
                            {widgetWidth < buttonTextCutoff ? "" : "Apply color set"}
                        </Button>
                    </PopoverNext>
                </ButtonGroup>
            </div>
            <FormGroup className="layer-config" label="Layer 1" inline={true}>
                {colorBlendingStore.baseFrame && (
                    <>
                        <Tooltip content={baseFrameTooltip}>
                            <Text className="image-column image-text" ellipsize={true}>
                                {colorBlendingStore.baseFrame.filename}
                            </Text>
                        </Tooltip>
                        {getLayerSettings(colorBlendingStore.baseFrame, 0)}
                    </>
                )}
            </FormGroup>
            {colorBlendingStore.selectedFrames.map((f, i) => (
                <FormGroup className="layer-config" label={`Layer ${i + 2}`} inline={true} key={i}>
                    <Tooltip content={selectedFrameTooltip}>
                        <HTMLSelect className="image-column" value={f.id} options={getSetFrameOptions(f)} onChange={ev => setSelectedFrame(i, parseInt(ev.target.value))} />
                    </Tooltip>
                    {getLayerSettings(f, i + 1)}
                </FormGroup>
            ))}
        </div>
    );
});
