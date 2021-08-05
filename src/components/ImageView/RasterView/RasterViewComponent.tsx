import * as React from "react";
import tinycolor from "tinycolor2";
import {observer} from "mobx-react";
import {AppStore, FrameStore} from "stores";
import {FrameView, Point2D, TileCoordinate} from "models";
import {GetRequiredTiles, GL, LayerToMip, add2D, scale2D, smoothStep, getColorForTheme} from "utilities";
import {RasterTile, TILE_SIZE, TileService, TileWebGLService} from "services";
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
    private gl: WebGLRenderingContext;
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
        const frame = this.props.frame;
        const tileRenderService = TileWebGLService.Instance;
        if (frame && this.canvas && this.gl && tileRenderService.cmapTexture) {
            const histStokes = frame.renderConfig.stokes;
            const histChannel = frame.renderConfig.histogram ? frame.renderConfig.histogram.channel : undefined;
            if ((frame.renderConfig.useCubeHistogram || frame.channel === histChannel) && frame.stokes === histStokes) {
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
            this.gl.uniform1f(shaderUniforms.CanvasWidth, (frame.renderWidth * devicePixelRatio) / frame.aspectRatio);
            this.gl.uniform1f(shaderUniforms.CanvasHeight, frame.renderHeight * devicePixelRatio);

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

            if (isFinite(this.props.pixelHighlightValue)) {
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
        const requiredWidth = Math.max(1, frame.renderWidth * devicePixelRatio);
        const requiredHeight = Math.max(1, frame.renderHeight * devicePixelRatio);

        const tileRenderService = TileWebGLService.Instance;
        // Resize and clear the canvas if needed
        if (frame?.isRenderable && (this.canvas.width !== requiredWidth || this.canvas.height !== requiredHeight)) {
            this.canvas.width = requiredWidth;
            this.canvas.height = requiredHeight;
        }
        // Resize and clear the shared WebGL canvas if required
        tileRenderService.setCanvasSize(requiredWidth * appStore.numImageColumns, requiredHeight * appStore.numImageRows);
    }

    private renderCanvas() {
        const frame = this.props.frame;
        // Only clear and render if we're in animation or tiled mode
        if (frame?.isRenderable) {
            const appStore = AppStore.Instance;
            const xOffset = this.props.column * frame.renderWidth * devicePixelRatio;
            // y-axis is inverted
            const yOffset = (appStore.numImageRows - 1 - this.props.row) * frame.renderHeight * devicePixelRatio;
            this.gl.viewport(xOffset, yOffset, frame.renderWidth * devicePixelRatio, frame.renderHeight * devicePixelRatio);
            this.gl.enable(WebGLRenderingContext.DEPTH_TEST);

            // Clear a scissored rectangle limited to the current frame
            this.gl.enable(WebGLRenderingContext.SCISSOR_TEST);
            this.gl.scissor(xOffset, yOffset, frame.renderWidth * devicePixelRatio, frame.renderHeight * devicePixelRatio);
            this.gl.clear(WebGLRenderingContext.COLOR_BUFFER_BIT | WebGLRenderingContext.DEPTH_BUFFER_BIT);
            this.gl.disable(WebGLRenderingContext.SCISSOR_TEST);

            // Skip rendering if frame is hidden
            if (frame.renderConfig.visible) {
                this.renderTiledCanvas();
            }
        }
    }

    private renderTiledCanvas() {
        const frame = this.props.frame;
        const tileRenderService = TileWebGLService.Instance;

        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, tileRenderService.vertexUVBuffer);
        this.gl.vertexAttribPointer(tileRenderService.vertexUVAttribute, 2, WebGLRenderingContext.FLOAT, false, 0, 0);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, tileRenderService.vertexPositionBuffer);
        this.gl.vertexAttribPointer(tileRenderService.vertexPositionAttribute, 3, WebGLRenderingContext.FLOAT, false, 0, 0);

        const imageSize = {x: frame.frameInfo.fileInfoExtended.width, y: frame.frameInfo.fileInfoExtended.height};
        const boundedView: FrameView = {
            xMin: Math.max(0, frame.requiredFrameView.xMin),
            xMax: Math.min(frame.requiredFrameView.xMax, imageSize.x),
            yMin: Math.max(0, frame.requiredFrameView.yMin),
            yMax: Math.min(frame.requiredFrameView.yMax, imageSize.y),
            mip: frame.requiredFrameView.mip
        };

        this.gl.activeTexture(WebGLRenderingContext.TEXTURE0);
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
            if (rasterTile) {
                this.renderTile(tile, rasterTile, mip);
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

        if (rasterTile.data) {
            tileService.uploadTileToGPU(rasterTile);
            delete rasterTile.data;
        }

        const textureParameters = tileService.getTileTextureParameters(rasterTile);
        if (textureParameters) {
            this.gl.bindTexture(WebGLRenderingContext.TEXTURE_2D, textureParameters.texture);
            this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_MIN_FILTER, GL.NEAREST);
            this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_MAG_FILTER, GL.NEAREST);
            this.gl.uniform2f(shaderUniforms.TileTextureOffset, textureParameters.offset.x, textureParameters.offset.y);
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
        if (frame.spatialReference) {
            zoomFactor = frame.spatialTransform.scale;
            zoom = (frame.spatialReference.zoomLevel / devicePixelRatio) * zoomFactor;
        } else {
            aspectRatio = frame.aspectRatio;
            zoom = frame.zoomLevel / devicePixelRatio;
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
        this.gl.drawArrays(WebGLRenderingContext.TRIANGLE_STRIP, 0, 4);
    }

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
        }
        /* eslint-enable @typescript-eslint/no-unused-vars */

        const padding = appStore.overlayStore.padding;
        let className = "raster-div";
        if (this.props.docked) {
            className += " docked";
        }

        return (
            <div className={className}>
                <canvas
                    className="raster-canvas"
                    id="raster-canvas"
                    ref={ref => (this.canvas = ref)}
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
