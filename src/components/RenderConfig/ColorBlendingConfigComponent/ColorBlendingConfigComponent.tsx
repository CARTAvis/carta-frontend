import * as React from "react";
import {AlphaPicker} from "react-color";
import {Button, ButtonGroup, Classes, FormGroup, H6, HTMLSelect, Menu, MenuItem, PopoverNext, Text, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {ColormapBlock, ColormapComponent, SafeNumericInput} from "components/Shared";
import {type ColormapSet, ImageType} from "enums";
import {AppStore, ColorBlendingStore, type FrameStore, type RenderConfigStore} from "stores";

import "./ColorBlendingConfigComponent.scss";

interface RenderConfigSnapshot {
    colorMap: string;
    customColormapHexEnd: string;
}

interface ColormapSetPreviewSession {
    store: ColorBlendingStore;
    snapshots: Map<RenderConfigStore, RenderConfigSnapshot>;
    activeSet: ColormapSet;
}

export class ColorBlendingColormapPreviewController {
    private readonly layerPreviewSessions = new Map<RenderConfigStore, RenderConfigSnapshot>();
    private colormapSetPreviewSession: ColormapSetPreviewSession | null = null;

    private captureSnapshot(renderConfig: RenderConfigStore): RenderConfigSnapshot {
        return {colorMap: renderConfig.colorMap, customColormapHexEnd: renderConfig.customColormapHexEnd};
    }

    private restoreSnapshot(renderConfig: RenderConfigStore, snapshot: RenderConfigSnapshot) {
        if (renderConfig.customColormapHexEnd !== snapshot.customColormapHexEnd) {
            renderConfig.setCustomHexEnd(snapshot.customColormapHexEnd);
        }
        if (renderConfig.colorMap !== snapshot.colorMap) {
            renderConfig.setColorMap(snapshot.colorMap);
        }
    }

    previewLayer(renderConfig: RenderConfigStore, colormap: string) {
        if (!this.layerPreviewSessions.has(renderConfig)) {
            this.layerPreviewSessions.set(renderConfig, this.captureSnapshot(renderConfig));
        }
        if (renderConfig.colorMap !== colormap) {
            renderConfig.setColorMap(colormap);
        }
    }

    commitLayer(renderConfig: RenderConfigStore, colormap: string) {
        this.layerPreviewSessions.delete(renderConfig);
        renderConfig.setColorMap(colormap);
    }

    closeLayer(renderConfig: RenderConfigStore, isOpen: boolean) {
        if (!isOpen) {
            const snapshot = this.layerPreviewSessions.get(renderConfig);
            this.layerPreviewSessions.delete(renderConfig);
            if (snapshot) {
                this.restoreSnapshot(renderConfig, snapshot);
            }
        }
    }

    previewColormapSet(store: ColorBlendingStore, set: ColormapSet) {
        if (this.colormapSetPreviewSession?.store !== store) {
            this.revertColormapSet();
            this.colormapSetPreviewSession = {
                store,
                snapshots: new Map(store.frames.filter(frame => !frame.rasterScalingReference).map(frame => [frame.renderConfig, this.captureSnapshot(frame.renderConfig)])),
                activeSet: set
            };
        } else if (this.colormapSetPreviewSession.activeSet === set) {
            return;
        } else {
            this.colormapSetPreviewSession.activeSet = set;
        }
        store.applyColormapSet(set);
    }

    commitColormapSet(store: ColorBlendingStore, set: ColormapSet) {
        if (this.colormapSetPreviewSession && this.colormapSetPreviewSession.store !== store) {
            this.revertColormapSet();
        } else {
            this.colormapSetPreviewSession = null;
        }
        store.applyColormapSet(set);
    }

    closeColormapSet(isOpen: boolean) {
        if (!isOpen) {
            this.revertColormapSet();
        }
    }

    private revertColormapSet() {
        const session = this.colormapSetPreviewSession;
        this.colormapSetPreviewSession = null;
        session?.snapshots.forEach((snapshot, renderConfig) => this.restoreSnapshot(renderConfig, snapshot));
    }

    revertAll() {
        this.layerPreviewSessions.forEach((snapshot, renderConfig) => this.restoreSnapshot(renderConfig, snapshot));
        this.layerPreviewSessions.clear();
        this.revertColormapSet();
    }
}

export const ColorBlendingConfigComponent = observer(({widgetWidth}: {widgetWidth: number}) => {
    const image = AppStore.Instance.activeImage;
    const colorBlendingStore = image?.type === ImageType.COLOR_BLENDING ? image.store : undefined;
    const previewController = React.useRef(new ColorBlendingColormapPreviewController()).current;

    React.useEffect(() => () => previewController.revertAll(), [colorBlendingStore, previewController]);

    if (!colorBlendingStore) {
        return null;
    }
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
            onClick={() => previewController.commitColormapSet(colorBlendingStore, set)}
            onFocus={() => previewController.previewColormapSet(colorBlendingStore, set)}
            onMouseEnter={() => previewController.previewColormapSet(colorBlendingStore, set)}
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
                        onColormapSelect={colormap => previewController.commitLayer(renderConfig, colormap)}
                        onColormapHover={colormap => previewController.previewLayer(renderConfig, colormap)}
                        onDropdownOpenChange={isOpen => previewController.closeLayer(renderConfig, isOpen)}
                        enableAdditionalColor={true}
                        onCustomColorSelect={renderConfig.setCustomHexEnd}
                        selectedCustomColor={renderConfig.customColormapHexEnd}
                        customColorStart={renderConfig.customColormapHexStart}
                    />
                </Tooltip>
                <div className="alpha-settings">
                    <AlphaPicker className="alpha-slider" color={{r: 0, g: 0, b: 0, a: alpha}} onChange={color => setAlpha(color.rgb.a)} />
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
                    <PopoverNext animation="minimal" arrow={false} shouldReturnFocusOnClose={false} onInteraction={isOpen => previewController.closeColormapSet(isOpen)} content={<Menu>{colormapSetOptions}</Menu>}>
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
