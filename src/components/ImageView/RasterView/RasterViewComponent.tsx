import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import tinycolor from "tinycolor2";

// import { PvPreviewComponent } from "components/PvGenerator/PvPreviewComponent";
import {FrameView, Point2D, TileCoordinate} from "models";
import {RasterTile, TEXTURE_SIZE, TILE_SIZE, TileService, TileWebGLService} from "services";
import {AppStore} from "stores";
import {FrameStore} from "stores/Frame";
import {add2D, copyToFP32Texture, createFP32Texture, getColorForTheme, GetRequiredTiles, GL2, LayerToMip, scale2D, smoothStep} from "utilities";

import "./RasterViewComponent.scss";

export class RasterViewComponentProps {
    docked: boolean;
    frame: FrameStore;
    pixelHighlightValue: number;
    row: number;
    column: number;
}

@observer
export class RasterViewComponent extends React.Component<RasterViewComponentProps> {
    private canvas: HTMLCanvasElement;
    private gl: WebGL2RenderingContext;
    private static readonly Float32Max = 3.402823466e38;

    componentDidMount() {
        this.gl = TileWebGLService.Instance.gl;
        if (this.canvas) {
            this.updateCanvas();
        }
        TileService.Instance.tileStream.subscribe(() => {
            requestAnimationFrame(this.updateCanvas);
        });
    }

    componentDidUpdate() {
        requestAnimationFrame(this.updateCanvas);
    }

    private updateCanvas = () => {
        AppStore.Instance.setCanvasUpdated();

        const frame = this.props.frame;
        const tileRenderService = TileWebGLService.Instance;
        if (frame && this.canvas && this.gl && tileRenderService.cmapTexture) {
            const histStokesIndex = frame.renderConfig.stokesIndex;
            const histChannel = frame.renderConfig.histogram ? frame.renderConfig.histChannel : undefined;
            if (((frame.renderConfig.useCubeHistogram || frame.channel === histChannel) && (frame.stokes === histStokesIndex || frame.polarizations.indexOf(frame.stokes) === histStokesIndex)) || frame.isPreview) {
                this.updateCanvasSize();
                this.updateUniforms();
                this.renderCanvas();
            }
            // draw in 2d canvas
            const ctx = this.canvas.getContext("2d");
            const w = this.canvas.width;
            const h = this.canvas.height;
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(this.gl.canvas, this.props.column * w, this.props.row * h, w, h, 0, 0, w, h);
        }
    };

    private updateUniforms() {
        const appStore = AppStore.Instance;
        const shaderUniforms = TileWebGLService.Instance.shaderUniforms;
        const frame = this.props.frame;
        const renderConfig = frame.renderConfig;
        const pixelRatio = devicePixelRatio * appStore.imageRatio;

        if (renderConfig && shaderUniforms) {
            this.gl.uniform1f(shaderUniforms.MinVal, renderConfig.scaleMinVal);
            this.gl.uniform1f(shaderUniforms.MaxVal, renderConfig.scaleMaxVal);
            this.gl.uniform1i(shaderUniforms.CmapIndex, renderConfig.colorMapIndex);
            this.gl.uniform1i(shaderUniforms.ScaleType, renderConfig.scaling);
            this.gl.uniform1i(shaderUniforms.Inverted, renderConfig.inverted ? 1 : 0);
            this.gl.uniform1f(shaderUniforms.Bias, renderConfig.bias);
            this.gl.uniform1f(shaderUniforms.Contrast, renderConfig.contrast);
            this.gl.uniform1i(shaderUniforms.UseSmoothedBiasContrast, appStore.preferenceStore.useSmoothedBiasContrast ? 1 : 0);
            this.gl.uniform1f(shaderUniforms.Gamma, renderConfig.gamma);
            this.gl.uniform1f(shaderUniforms.Alpha, renderConfig.alpha);
            this.gl.uniform1f(shaderUniforms.CanvasWidth, frame.renderWidth * pixelRatio);
            this.gl.uniform1f(shaderUniforms.CanvasHeight, frame.renderHeight * pixelRatio);

            const nanColor = tinycolor(appStore.preferenceStore.nanColorHex).setAlpha(appStore.preferenceStore.nanAlpha);
            if (nanColor.isValid()) {
                const rgba = nanColor.toRgb();
                this.gl.uniform4f(shaderUniforms.NaNColor, rgba.r / 255, rgba.g / 255, rgba.b / 255, rgba.a);
            }

            const pixelGridColor = tinycolor(getColorForTheme(appStore.preferenceStore.pixelGridColor));
            if (pixelGridColor.isValid()) {
                const rgba = pixelGridColor.toRgb();
                this.gl.uniform4f(shaderUniforms.PixelGridColor, rgba.r / 255, rgba.g / 255, rgba.b / 255, rgba.a);
            } else {
                this.gl.uniform4f(shaderUniforms.PixelGridColor, 0, 0, 0, 0);
            }

            if (isFinite(this.props.pixelHighlightValue) && !appStore.isExportingImage) {
                this.gl.uniform1f(shaderUniforms.PixelHighlightVal, this.props.pixelHighlightValue);
            } else {
                this.gl.uniform1f(shaderUniforms.PixelHighlightVal, -RasterViewComponent.Float32Max);
            }
        }
    }

    private updateCanvasSize() {
        const frame = this.props.frame;

        if (!frame) {
            return;
        }

        const appStore = AppStore.Instance;
        const pixelRatio = devicePixelRatio * appStore.imageRatio;
        const requiredWidth = Math.max(1, frame.renderWidth * pixelRatio);
        const requiredHeight = Math.max(1, frame.renderHeight * pixelRatio);

        const tileRenderService = TileWebGLService.Instance;
        // Resize and clear the canvas if needed
        if (frame?.isRenderable && (this.canvas.width !== requiredWidth || this.canvas.height !== requiredHeight)) {
            this.canvas.width = requiredWidth;
            this.canvas.height = requiredHeight;
        }
        // Resize and clear the shared WebGL canvas if required
        tileRenderService.setCanvasSize(requiredWidth * appStore.numImageColumns, requiredHeight * appStore.numImageRows);

        if (this.gl.drawingBufferWidth !== this.gl.canvas.width || this.gl.drawingBufferHeight !== this.gl.canvas.height) {
            appStore.decreaseImageRatio();
        }
    }

    private renderCanvas() {
        const frame = this.props.frame;

        // Only clear and render if we're in animation or tiled mode
        if (frame?.isRenderable) {
            const appStore = AppStore.Instance;
            const pixelRatio = devicePixelRatio * appStore.imageRatio;
            const xOffset = this.props.column * frame.renderWidth * pixelRatio;
            // y-axis is inverted
            const yOffset = (appStore.numImageRows - 1 - this.props.row) * frame.renderHeight * pixelRatio;
            this.gl.viewport(xOffset, yOffset, frame.renderWidth * pixelRatio, frame.renderHeight * pixelRatio);
            this.gl.enable(GL2.DEPTH_TEST);

            // Clear a scissored rectangle limited to the current frame
            this.gl.enable(GL2.SCISSOR_TEST);
            this.gl.scissor(xOffset, yOffset, frame.renderWidth * pixelRatio, frame.renderHeight * pixelRatio);
            this.gl.clear(GL2.COLOR_BUFFER_BIT | GL2.DEPTH_BUFFER_BIT);
            this.gl.disable(GL2.SCISSOR_TEST);

            // Skip rendering if frame is hidden
            if (frame.renderConfig.visible) {
                this.renderTiledCanvas();
            }
        }
    }

    private renderTiledCanvas() {
        const frame = this.props.frame;

        const imageSize = {x: frame.frameInfo.fileInfoExtended.width, y: frame.frameInfo.fileInfoExtended.height};
        const boundedView: FrameView = {
            xMin: Math.max(0, frame.requiredFrameView.xMin),
            xMax: Math.min(frame.requiredFrameView.xMax, imageSize.x),
            yMin: Math.max(0, frame.requiredFrameView.yMin),
            yMax: Math.min(frame.requiredFrameView.yMax, imageSize.y),
            mip: frame.requiredFrameView.mip
        };

        this.gl.activeTexture(GL2.TEXTURE0);
        const requiredTiles = GetRequiredTiles(boundedView, imageSize, {x: TILE_SIZE, y: TILE_SIZE});
        // Special case when zoomed out
        if (requiredTiles.length === 1 && requiredTiles[0].layer === 0) {
            const mip = LayerToMip(0, imageSize, {x: TILE_SIZE, y: TILE_SIZE});
            this.renderTiles(requiredTiles, mip, false, 3, true);
        } else {
            this.renderTiles(requiredTiles, boundedView.mip, false, 3, true);
        }
    }

    private renderTiles(tiles: TileCoordinate[], mip: number, peek: boolean = false, numPlaceholderLayersHighRes: number, renderLowRes: boolean) {
        const tileService = TileService.Instance;
        const frame = this.props.frame;

        if (!tileService) {
            return;
        }

        const placeholderTileMap = new Map<number, boolean>();
        const highResPlaceholders = [];

        for (const tile of tiles) {
            const encodedCoordinate = TileCoordinate.EncodeCoordinate(tile);
            const rasterTile = tileService.getTile(encodedCoordinate, frame.frameInfo.fileId, frame.channel, frame.stokes, peek);
            if (rasterTile || frame.isPreview) {
                this.renderTile(tile, frame.isPreview ? {data: frame.rasterData, width: frame.frameInfo.fileInfoExtended.width, height: frame.frameInfo.fileInfoExtended.height, textureCoordinate: 0} : rasterTile, mip);
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
            this.renderTiles(highResPlaceholders, mip / 2, true, numPlaceholderLayersHighRes - 1, false);
        }
        if (renderLowRes) {
            const placeholderTileList: TileCoordinate[] = [];
            placeholderTileMap.forEach((val, encodedTile) => placeholderTileList.push(TileCoordinate.Decode(encodedTile)));
            if (placeholderTileList.length) {
                this.renderTiles(placeholderTileList, mip * 2, true, 0, true);
            }
        }
    }

    private get panelIndex() {
        const panelElement = this.canvas?.parentElement?.parentElement;
        const viewElement = panelElement?.parentElement;
        const numPanels = (viewElement?.children?.length ?? 0) - 1;
        for (let i = 0; i < numPanels; i++) {
            if (viewElement.children[i] === panelElement) {
                return i;
            }
        }
        return -1;
    }

    private renderTile(tile: TileCoordinate, rasterTile: RasterTile, mip: number) {
        const appStore = AppStore.Instance;
        const frame = this.props.frame;
        const shaderUniforms = TileWebGLService.Instance.shaderUniforms;
        const tileService = TileService.Instance;
        if (!rasterTile) {
            return;
        }

        if (rasterTile.data && !frame.isPreview) {
            tileService.uploadTileToGPU(rasterTile);
            delete rasterTile.data;
        }

        if (frame.isPreview) {
            const texture = createFP32Texture(this.gl, TEXTURE_SIZE, TEXTURE_SIZE, GL2.TEXTURE0);
            copyToFP32Texture(this.gl, texture, frame.rasterData, GL2.TEXTURE0, frame.frameInfo.fileInfoExtended.width, frame.frameInfo.fileInfoExtended.height, 0, 0);
            this.gl.bindTexture(GL2.TEXTURE_2D, texture);
            this.gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MIN_FILTER, GL2.NEAREST);
            this.gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MAG_FILTER, GL2.NEAREST);
            this.gl.uniform2f(shaderUniforms.TileTextureOffset, 0, 0);
        } else {
            const textureParameters = tileService.getTileTextureParameters(rasterTile);
            if (textureParameters) {
                this.gl.bindTexture(GL2.TEXTURE_2D, textureParameters.texture);
                this.gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MIN_FILTER, GL2.NEAREST);
                this.gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MAG_FILTER, GL2.NEAREST);
                this.gl.uniform2f(shaderUniforms.TileTextureOffset, textureParameters.offset.x, textureParameters.offset.y);
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
            this.gl.uniform2f(shaderUniforms.RotationOrigin, rotationOriginCanvasSpace.x, rotationOriginCanvasSpace.y);
            this.gl.uniform1f(shaderUniforms.RotationAngle, -frame.spatialTransform.rotation);
            this.gl.uniform1f(shaderUniforms.ScaleAdjustment, frame.spatialTransform.scale);
        } else {
            this.gl.uniform2f(shaderUniforms.RotationOrigin, 0, 0);
            this.gl.uniform1f(shaderUniforms.RotationAngle, 0);
            this.gl.uniform1f(shaderUniforms.ScaleAdjustment, 1);
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
            this.gl.uniform1f(shaderUniforms.PixelGridCutoff, cutoff);
            this.gl.uniform1f(shaderUniforms.PixelGridOpacity, opacity);
        } else {
            this.gl.uniform1f(shaderUniforms.PixelGridOpacity, 0);
        }
        this.gl.uniform1f(shaderUniforms.PixelAspectRatio, aspectRatio);

        // take zoom level into account to convert from image space to canvas space
        bottomLeft = scale2D(bottomLeft, spatialRef.zoomLevel);
        this.gl.uniform2f(shaderUniforms.TileSize, rasterTile.width, rasterTile.height);
        this.gl.uniform2f(shaderUniforms.TileOffset, bottomLeft.x, bottomLeft.y);
        this.gl.uniform2f(shaderUniforms.TileScaling, tileScaling.x, tileScaling.y);
        this.gl.drawArrays(GL2.TRIANGLE_STRIP, 0, 4);
    }

    private getRef = ref => {
        this.canvas = ref;
    };

    render() {
        // dummy values to trigger React's componentDidUpdate()
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const appStore = AppStore.Instance;
        const frame = this.props.frame;
        if (frame) {
            const spatialReference = frame.spatialReference || frame;
            const frameView = spatialReference.requiredFrameView;
            const currentView = spatialReference.currentFrameView;

            const colorMapping = {
                min: frame.renderConfig.scaleMinVal,
                max: frame.renderConfig.scaleMaxVal,
                colorMap: frame.renderConfig.colorMapIndex,
                contrast: frame.renderConfig.contrast,
                bias: frame.renderConfig.bias,
                useSmoothedBiasContrast: appStore.preferenceStore?.useSmoothedBiasContrast,
                scaling: frame.renderConfig.scaling,
                gamma: frame.renderConfig.gamma,
                alpha: frame.renderConfig.alpha,
                inverted: frame.renderConfig.inverted,
                visibility: frame.renderConfig.visible,
                nanColorHex: appStore.preferenceStore.nanColorHex,
                nanAlpha: appStore.preferenceStore.nanAlpha,
                pixelGridVisible: appStore.preferenceStore.pixelGridVisible,
                pixelGridColor: getColorForTheme(appStore.preferenceStore.pixelGridColor)
            };

            const ratio = appStore.imageRatio;
        }
        /* eslint-enable @typescript-eslint/no-unused-vars */

        const padding = appStore.overlayStore.padding;
        const className = classNames("raster-div", {docked: this.props.docked});

        return (
            <div className={className}>
                <canvas
                    className="raster-canvas"
                    id="raster-canvas"
                    ref={this.getRef}
                    style={{
                        top: padding.top,
                        left: padding.left,
                        width: frame?.isRenderable ? frame.renderWidth || 1 : 1,
                        height: frame?.isRenderable ? frame.renderHeight || 1 : 1
                    }}
                />
            </div>
        );
    }
}
