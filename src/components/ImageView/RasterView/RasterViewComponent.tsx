import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import tinycolor from "tinycolor2";

import {FrameView, Point2D, TileCoordinate} from "models";
import {PreviewWebGLService, RasterTile, ShaderUniforms, TEXTURE_SIZE, TILE_SIZE, TileService, TileWebGLService} from "services";
import {AppStore} from "stores";
import {FrameStore} from "stores/Frame";
import {add2D, copyToFP32Texture, createFP32Texture, getColorForTheme, GetRequiredTiles, GL2, LayerToMip, scale2D, smoothStep} from "utilities";

import "./RasterViewComponent.scss";

export class RasterViewComponentProps {
    docked: boolean;
    frame: FrameStore;
    pixelHighlightValue: number;
    renderWidth: number;
    renderHeight: number;
    row: number;
    column: number;
    numImageColumns: number;
    numImageRows: number;
    gl: WebGL2RenderingContext;
    tileBasedRender: boolean;
    rasterData?: Float32Array;
}

const Float32Max = 3.402823466e38;

export const RasterViewComponent: React.FC<RasterViewComponentProps> = observer((props: RasterViewComponentProps) => {
    const canvas = React.useRef<HTMLCanvasElement>();
    const gl = props.gl;

    React.useEffect(() => {
        if (props.tileBasedRender) {
            if (canvas) {
                updateCanvas(props.frame, gl, canvas.current, props.renderWidth, props.renderHeight, props.column, props.row, props.numImageColumns, props.numImageRows, props.pixelHighlightValue, props.tileBasedRender, props.rasterData);
            }
            TileService.Instance.tileStream.subscribe(() => {
                requestAnimationFrame(() =>
                    updateCanvas(props.frame, gl, canvas.current, props.renderWidth, props.renderHeight, props.column, props.row, props.numImageColumns, props.numImageRows, props.pixelHighlightValue, props.tileBasedRender, props.rasterData)
                );
            });
        }
    }, []);

    React.useEffect(() => {
        requestAnimationFrame(() =>
            updateCanvas(props.frame, gl, canvas.current, props.renderWidth, props.renderHeight, props.column, props.row, props.numImageColumns, props.numImageRows, props.pixelHighlightValue, props.tileBasedRender, props.rasterData)
        );
    }, [props.frame.zoomLevel, props.frame.center]);

    // // dummy values to trigger React's componentDidUpdate()
    // /* eslint-disable @typescript-eslint/no-unused-vars */
    const appStore = AppStore.Instance;
    const frame = props.frame;
    // if (frame) {
    //     const spatialReference = frame.spatialReference || frame;
    //     const frameView = spatialReference.requiredFrameView;
    //     const currentView = spatialReference.currentFrameView;
    //     const colorMapping = {
    //         min: frame.renderConfig.scaleMinVal,
    //         max: frame.renderConfig.scaleMaxVal,
    //         colorMap: frame.renderConfig.colorMapIndex,
    //         contrast: frame.renderConfig.contrast,
    //         bias: frame.renderConfig.bias,
    //         useSmoothedBiasContrast: appStore.preferenceStore?.useSmoothedBiasContrast,
    //         scaling: frame.renderConfig.scaling,
    //         gamma: frame.renderConfig.gamma,
    //         alpha: frame.renderConfig.alpha,
    //         inverted: frame.renderConfig.inverted,
    //         visibility: frame.renderConfig.visible,
    //         nanColorHex: appStore.preferenceStore.nanColorHex,
    //         nanAlpha: appStore.preferenceStore.nanAlpha,
    //         pixelGridVisible: appStore.preferenceStore.pixelGridVisible,
    //         pixelGridColor: getColorForTheme(appStore.preferenceStore.pixelGridColor)
    //     };
    //     const ratio = appStore.imageRatio;
    // }
    /* eslint-enable @typescript-eslint/no-unused-vars */
    const padding = appStore.overlayStore.padding;
    const className = classNames("raster-div", {docked: props.docked});

    return (
        <div className={className}>
            <canvas
                className={`raster-canvas-${props.row}-${props.column}`}
                id="raster-canvas"
                ref={ref => (canvas.current = ref)}
                style={{
                    top: padding.top + (props.row * props.renderHeight * 2) / props.numImageRows,
                    left: padding.left + (props.column * props.renderWidth * 2) / props.numImageColumns,
                    width: frame?.isRenderable ? props.renderWidth || 1 : 1,
                    height: frame?.isRenderable ? props.renderHeight || 1 : 1
                }}
            />
        </div>
    );
});

const updateCanvas = (
    frame: FrameStore,
    gl: WebGL2RenderingContext,
    canvas: HTMLCanvasElement,
    renderWidth: number,
    renderHeight: number,
    column: number,
    row: number,
    numImageColumns: number,
    numImageRows: number,
    pixelHighlightValue: number,
    tileBasedRender: boolean,
    rasterData?: Float32Array
) => {
    AppStore.Instance.setCanvasUpdated();

    const tileRenderService = frame.isPreview ? PreviewWebGLService.Instance : TileWebGLService.Instance;
    if (frame && canvas && gl && tileRenderService.cmapTexture) {
        const histStokesIndex = frame.renderConfig.stokesIndex;
        const histChannel = frame.renderConfig.histogram ? frame.renderConfig.histChannel : undefined;
        if ((frame.renderConfig.useCubeHistogram || frame.channel === histChannel || frame.isPreview) && (frame.stokes === histStokesIndex || frame.polarizations.indexOf(frame.stokes) === histStokesIndex)) {
            const pixelRatio = devicePixelRatio * AppStore.Instance.imageRatio;
            const xOffset = column * renderWidth * pixelRatio;
            const yOffset = gl.canvas.height - renderHeight * (row + 1) * pixelRatio;
            updateCanvasSize(frame, gl, canvas, renderWidth, renderHeight, numImageColumns, numImageRows, tileBasedRender);
            updateUniforms(frame, gl, tileRenderService.shaderUniforms, renderWidth, renderHeight, pixelHighlightValue);
            renderCanvas(frame, gl, xOffset, yOffset, renderWidth, renderHeight, tileBasedRender, rasterData); // change column and row to x and y offset
        }
        // draw in 2d canvas
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(gl.canvas, column * w, row * h, w, h, 0, 0, w, h);
    }
};

function updateCanvasSize(frame: FrameStore, gl: WebGL2RenderingContext, canvas: HTMLCanvasElement, renderWidth: number, renderHeight: number, numImageColumns: number, numImageRows: number, tileBasedRender: boolean) {
    if (!frame) {
        return;
    }

    const appStore = AppStore.Instance;
    const pixelRatio = devicePixelRatio * appStore.imageRatio;
    const requiredWidth = Math.max(1, renderWidth * pixelRatio);
    const requiredHeight = Math.max(1, renderHeight * pixelRatio);

    const tileRenderService = tileBasedRender ? TileWebGLService.Instance : PreviewWebGLService.Instance;
    // Resize and clear the canvas if needed
    if (frame?.isRenderable && (canvas.width !== requiredWidth || canvas.height !== requiredHeight)) {
        canvas.width = requiredWidth;
        canvas.height = requiredHeight;
    }
    // Resize and clear the shared WebGL canvas if required
    tileRenderService.setCanvasSize(requiredWidth * numImageColumns, requiredHeight * numImageRows);

    if (gl.drawingBufferWidth !== gl.canvas.width || gl.drawingBufferHeight !== gl.canvas.height) {
        appStore.decreaseImageRatio();
    }
}

export function updateUniforms(frame: FrameStore, gl: WebGL2RenderingContext, shaderUniforms: ShaderUniforms, renderWidth: number, renderHeight: number, pixelHighlightValue: number) {
    const appStore = AppStore.Instance;
    const renderConfig = frame.renderConfig;
    const pixelRatio = devicePixelRatio * appStore.imageRatio;

    if (renderConfig && shaderUniforms) {
        gl.uniform1f(shaderUniforms.MinVal, renderConfig.scaleMinVal);
        gl.uniform1f(shaderUniforms.MaxVal, renderConfig.scaleMaxVal);
        gl.uniform1i(shaderUniforms.CmapIndex, renderConfig.colorMapIndex);
        gl.uniform1i(shaderUniforms.ScaleType, renderConfig.scaling);
        gl.uniform1i(shaderUniforms.Inverted, renderConfig.inverted ? 1 : 0);
        gl.uniform1f(shaderUniforms.Bias, renderConfig.bias);
        gl.uniform1f(shaderUniforms.Contrast, renderConfig.contrast);
        gl.uniform1i(shaderUniforms.UseSmoothedBiasContrast, appStore.preferenceStore.useSmoothedBiasContrast ? 1 : 0);
        gl.uniform1f(shaderUniforms.Gamma, renderConfig.gamma);
        gl.uniform1f(shaderUniforms.Alpha, renderConfig.alpha);
        gl.uniform1f(shaderUniforms.CanvasWidth, renderWidth * pixelRatio);
        gl.uniform1f(shaderUniforms.CanvasHeight, renderHeight * pixelRatio);

        const nanColor = tinycolor(appStore.preferenceStore.nanColorHex).setAlpha(appStore.preferenceStore.nanAlpha);
        if (nanColor.isValid()) {
            const rgba = nanColor.toRgb();
            gl.uniform4f(shaderUniforms.NaNColor, rgba.r / 255, rgba.g / 255, rgba.b / 255, rgba.a);
        }

        const pixelGridColor = tinycolor(getColorForTheme(appStore.preferenceStore.pixelGridColor));
        if (pixelGridColor.isValid()) {
            const rgba = pixelGridColor.toRgb();
            gl.uniform4f(shaderUniforms.PixelGridColor, rgba.r / 255, rgba.g / 255, rgba.b / 255, rgba.a);
        } else {
            gl.uniform4f(shaderUniforms.PixelGridColor, 0, 0, 0, 0);
        }

        if (isFinite(pixelHighlightValue) && !appStore.isExportingImage) {
            gl.uniform1f(shaderUniforms.PixelHighlightVal, pixelHighlightValue);
        } else {
            gl.uniform1f(shaderUniforms.PixelHighlightVal, -Float32Max);
        }
    }
}

export function renderCanvas(frame: FrameStore, gl: WebGL2RenderingContext, xOffset: number, yOffset: number, renderWidth: number, renderHeight: number, tileBasedRender: boolean, rasterData?: Float32Array) {
    // Only clear and render if we're in animation or tiled mode
    if (frame?.isRenderable) {
        const appStore = AppStore.Instance;
        const pixelRatio = devicePixelRatio * appStore.imageRatio;
        // const xOffset = column * frame.renderWidth * pixelRatio;
        // y-axis is inverted
        // const yOffset = gl.canvas.height - frame.renderHeight * (row + 1) * pixelRatio;
        gl.viewport(xOffset, yOffset, renderWidth * pixelRatio, renderHeight * pixelRatio); // will need to update renderWidth and height
        gl.enable(GL2.DEPTH_TEST);

        // console.log(renderWidth, renderHeight)

        // Clear a scissored rectangle limited to the current frame
        gl.enable(GL2.SCISSOR_TEST);
        gl.scissor(xOffset, yOffset, renderWidth * pixelRatio, renderHeight * pixelRatio);
        gl.clear(GL2.COLOR_BUFFER_BIT | GL2.DEPTH_BUFFER_BIT);
        gl.disable(GL2.SCISSOR_TEST);

        // Skip rendering if frame is hidden
        if (frame.renderConfig.visible) {
            tileBasedRender ? renderTiledCanvas(frame, gl) : renderRasterCanvas(frame, gl, rasterData);
        }
    }
}

function renderRasterCanvas(frame: FrameStore, gl: WebGL2RenderingContext, rasterData: Float32Array) {
    //Preview frame is always rendered with one tile
    const rasterTile = {data: rasterData, width: frame.frameInfo.fileInfoExtended.width, height: frame.frameInfo.fileInfoExtended.height, textureCoordinate: 0};
    const tile = {x: 0, y: 0, layer: 0} as TileCoordinate;

    renderTile(frame, gl, tile, rasterTile, frame.requiredFrameView.mip, false);
}

function renderTiledCanvas(frame: FrameStore, gl: WebGL2RenderingContext) {
    const imageSize = {x: frame.frameInfo.fileInfoExtended.width, y: frame.frameInfo.fileInfoExtended.height};
    const boundedView: FrameView = {
        xMin: Math.max(0, frame.requiredFrameView.xMin),
        xMax: Math.min(frame.requiredFrameView.xMax, imageSize.x),
        yMin: Math.max(0, frame.requiredFrameView.yMin),
        yMax: Math.min(frame.requiredFrameView.yMax, imageSize.y),
        mip: frame.requiredFrameView.mip
    };

    gl.activeTexture(GL2.TEXTURE0);

    const requiredTiles = GetRequiredTiles(boundedView, imageSize, {x: TILE_SIZE, y: TILE_SIZE});
    // Special case when zoomed out
    if (requiredTiles.length === 1 && requiredTiles[0].layer === 0) {
        const mip = LayerToMip(0, imageSize, {x: TILE_SIZE, y: TILE_SIZE});
        renderTiles(frame, gl, requiredTiles, mip, false, 3, true);
    } else {
        renderTiles(frame, gl, requiredTiles, boundedView.mip, false, 3, true);
    }
}

function renderTiles(frame: FrameStore, gl: WebGL2RenderingContext, tiles: TileCoordinate[], mip: number, peek: boolean = false, numPlaceholderLayersHighRes: number, renderLowRes: boolean) {
    const tileService = TileService.Instance;

    if (!tileService) {
        return;
    }

    const placeholderTileMap = new Map<number, boolean>();
    const highResPlaceholders = [];

    for (const tile of tiles) {
        const encodedCoordinate = TileCoordinate.EncodeCoordinate(tile);
        const rasterTile = tileService.getTile(encodedCoordinate, frame.frameInfo.fileId, peek);
        if (rasterTile) {
            renderTile(frame, gl, tile, rasterTile, mip, true);
        } else {
            // Add high-res placeholders
            if (numPlaceholderLayersHighRes > 0 && mip >= 2) {
                highResPlaceholders.push({
                    layer: tile.layer + 1,
                    x: tile.x * 2,
                    y: tile.y * 2
                });
                highResPlaceholders.push({
                    layer: tile.layer + 1,
                    x: tile.x * 2 + 1,
                    y: tile.y * 2
                });
                highResPlaceholders.push({
                    layer: tile.layer + 1,
                    x: tile.x * 2,
                    y: tile.y * 2 + 1
                });
                highResPlaceholders.push({
                    layer: tile.layer + 1,
                    x: tile.x * 2 + 1,
                    y: tile.y * 2 + 1
                });
            }

            // Add low-res placeholders
            if (tile.layer > 0 && renderLowRes) {
                const lowResTile = {
                    layer: tile.layer - 1,
                    x: Math.floor(tile.x / 2.0),
                    y: Math.floor(tile.y / 2.0)
                };
                placeholderTileMap.set(TileCoordinate.EncodeCoordinate(lowResTile), true);
            }
        }
    }

    // Render remaining placeholders
    if (numPlaceholderLayersHighRes > 0 && highResPlaceholders.length) {
        renderTiles(frame, gl, highResPlaceholders, mip / 2, true, numPlaceholderLayersHighRes - 1, false);
    }
    if (renderLowRes) {
        const placeholderTileList: TileCoordinate[] = [];
        placeholderTileMap.forEach((val, encodedTile) => placeholderTileList.push(TileCoordinate.Decode(encodedTile)));
        if (placeholderTileList.length) {
            renderTiles(frame, gl, placeholderTileList, mip * 2, true, 0, true);
        }
    }
}

export function renderTile(frame: FrameStore, gl: WebGL2RenderingContext, tile: TileCoordinate, rasterTile: RasterTile, mip: number, tileBasedRender: boolean) {
    const appStore = AppStore.Instance;
    const shaderUniforms = tileBasedRender ? TileWebGLService.Instance.shaderUniforms : PreviewWebGLService.Instance.shaderUniforms;
    const tileService = TileService.Instance;
    if (!rasterTile) {
        return;
    }

    if (rasterTile.data && tileBasedRender) {
        tileService.uploadTileToGPU(rasterTile);
        delete rasterTile.data;
    }

    // if (!tileBasedRender && rasterTile.width * rasterTile.height === rasterTile.data.length) {
    if (!tileBasedRender) {
        const texture = createFP32Texture(gl, rasterTile.width, rasterTile.height, GL2.TEXTURE0);
        copyToFP32Texture(gl, texture, rasterTile.data, GL2.TEXTURE0, rasterTile.width, rasterTile.height, 0, 0);
        gl.bindTexture(GL2.TEXTURE_2D, texture);
        gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MIN_FILTER, GL2.NEAREST);
        gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MAG_FILTER, GL2.NEAREST);
        gl.uniform2f(shaderUniforms.TileTextureOffset, 0, 0);
        gl.uniform2f(shaderUniforms.TileTextureSize, rasterTile.width, rasterTile.height);
        gl.uniform2f(shaderUniforms.TextureSize, rasterTile.width, rasterTile.height);
    } else {
        const textureParameters = tileService.getTileTextureParameters(rasterTile);
        if (textureParameters) {
            gl.bindTexture(GL2.TEXTURE_2D, textureParameters.texture);
            gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MIN_FILTER, GL2.NEAREST);
            gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MAG_FILTER, GL2.NEAREST);
            gl.uniform2f(shaderUniforms.TileTextureOffset, textureParameters.offset.x, textureParameters.offset.y);
            gl.uniform2f(shaderUniforms.TileTextureSize, TILE_SIZE, TILE_SIZE);
            gl.uniform2f(shaderUniforms.TextureSize, TEXTURE_SIZE, TEXTURE_SIZE);
        }
    }

    const spatialRef = frame.spatialReference || frame;
    const full = spatialRef.requiredFrameView;

    const tileSizeAdjusted = mip * TILE_SIZE;
    const tileImageView: FrameView = {
        xMin: tile.x * tileSizeAdjusted,
        yMin: tile.y * tileSizeAdjusted,
        xMax: (tile.x + 1) * tileSizeAdjusted,
        yMax: (tile.y + 1) * tileSizeAdjusted,
        mip: 1
    };
    let bottomLeft = {x: tileImageView.xMin - full.xMin - 0.5, y: tileImageView.yMin - full.yMin - 0.5};
    let tileScaling = scale2D({x: 1, y: 1}, mip * spatialRef.zoomLevel);

    if (frame.spatialReference && frame.spatialTransform) {
        bottomLeft = add2D(bottomLeft, frame.spatialTransform.translation);
        // set origin of rotation to image center
        const rotationOriginImageSpace: Point2D = add2D(frame.spatialTransform.origin, frame.spatialTransform.translation);
        const rotationOriginCanvasSpace: Point2D = {
            x: spatialRef.zoomLevel * (rotationOriginImageSpace.x - full.xMin),
            y: spatialRef.zoomLevel * (rotationOriginImageSpace.y - full.yMin)
        };
        gl.uniform2f(shaderUniforms.RotationOrigin, rotationOriginCanvasSpace.x, rotationOriginCanvasSpace.y);
        gl.uniform1f(shaderUniforms.RotationAngle, -frame.spatialTransform.rotation);
        gl.uniform1f(shaderUniforms.ScaleAdjustment, frame.spatialTransform.scale);
    } else {
        gl.uniform2f(shaderUniforms.RotationOrigin, 0, 0);
        gl.uniform1f(shaderUniforms.RotationAngle, 0);
        gl.uniform1f(shaderUniforms.ScaleAdjustment, 1);
    }

    let zoom;
    let zoomFactor = 1.0;
    let aspectRatio = 1.0;
    const pixelRatio = devicePixelRatio * appStore.imageRatio;
    if (frame.spatialReference) {
        zoomFactor = frame.spatialTransform.scale;
        zoom = (frame.spatialReference.zoomLevel / pixelRatio) * zoomFactor;
    } else {
        aspectRatio = frame.aspectRatio;
        zoom = frame.zoomLevel / pixelRatio;
    }

    const pixelGridZoomLow = 6.0;
    const pixelGridZoomHigh = 12.0;

    if (zoom >= pixelGridZoomLow && mip === 1 && appStore.preferenceStore.pixelGridVisible) {
        const cutoff = 0.5 / zoom;
        const opacity = 0.25 * smoothStep(zoom, pixelGridZoomLow, pixelGridZoomHigh);
        gl.uniform1f(shaderUniforms.PixelGridCutoff, cutoff);
        gl.uniform1f(shaderUniforms.PixelGridOpacity, opacity);
    } else {
        gl.uniform1f(shaderUniforms.PixelGridOpacity, 0);
    }
    gl.uniform1f(shaderUniforms.PixelAspectRatio, aspectRatio);
    // take zoom level into account to convert from image space to canvas space
    bottomLeft = scale2D(bottomLeft, spatialRef.zoomLevel);
    gl.uniform2f(shaderUniforms.TileSize, rasterTile.width, rasterTile.height);
    gl.uniform2f(shaderUniforms.TileOffset, bottomLeft.x, bottomLeft.y);
    gl.uniform2f(shaderUniforms.TileScaling, tileScaling.x, tileScaling.y);
    gl.drawArrays(GL2.TRIANGLE_STRIP, 0, 4);
}
