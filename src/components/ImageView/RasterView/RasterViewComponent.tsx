import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import {Subscription} from "rxjs";
import tinycolor from "tinycolor2";

import {FrameView, ImageItem, ImageType, Point2D, TileCoordinate} from "models";
import {PreviewWebGLService, RasterTile, TEXTURE_SIZE, TILE_SIZE, TileService, TileWebGLService} from "services";
import {AppStore} from "stores";
import {FrameStore} from "stores/Frame";
import {add2D, copyToFP32Texture, createFP32Texture, getColorForTheme, GetRequiredTiles, GL2, LayerToMip, scale2D, smoothStep} from "utilities";

import "./RasterViewComponent.scss";

export class RasterViewComponentProps {
    docked: boolean;
    image: ImageItem;
    pixelHighlightValue: number;
    row: number;
    column: number;
    renderWidth?: number;
    renderHeight?: number;
    channel?: number[];
}

@observer
export class RasterViewComponent extends React.Component<RasterViewComponentProps> {
    private sub: Subscription;
    private canvas: HTMLCanvasElement;
    private gl: WebGL2RenderingContext;
    private static readonly Float32Max = 3.402823466e38;

    componentDidMount() {
        const isPreview = this.props.image?.type === ImageType.PV_PREVIEW;
        this.gl = isPreview ? PreviewWebGLService.Instance.gl : TileWebGLService.Instance.gl;
        if (!isPreview) {
            if (this.canvas) {
                this.updateCanvas();
            }
        }

        this.sub = TileService.Instance.tileStream.subscribe(tileMessage => {
            if ((!isFinite(this.props.channel?.length) && (!AppStore.Instance.channelMapStore.channelMapEnabled || (this.props.image.store as FrameStore).isPreview)) || this.props.channel.includes(tileMessage.channel)) {
                requestAnimationFrame(() => this.updateCanvas());
            }
        });
    }

    componentWillUnmount(): void {
        this.sub && this.sub.unsubscribe();
    }
    componentDidUpdate() {
        requestAnimationFrame(() => this.updateCanvas());
    }

    private renderMultipleCanvas = (frame: FrameStore) => {
        const canvas = this.canvas;
        const channels = this.props.channel;
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        this.gl.clear(GL2.COLOR_BUFFER_BIT | GL2.DEPTH_BUFFER_BIT);

        if (!channels.length) {
            return;
        }

        const pixelRatio = AppStore.Instance.pixelRatio;
        const innerRenderWidth = frame.channelMapInnerOverlayStore.renderWidth;
        const innerRenderHeight = frame.channelMapInnerOverlayStore.renderHeight;
        const gapX = frame.channelMapInnerOverlayStore.gapX;
        const gapY = frame.channelMapInnerOverlayStore.gapY;

        channels.forEach((channel, index) => {
            const appStore = AppStore.Instance;
            const channelMapStore = appStore.channelMapStore;
            const column = index % channelMapStore.numColumns;
            const row = Math.floor(index / channelMapStore.numColumns);

            const xOffset = Math.round((innerRenderWidth + gapX) * column * pixelRatio);
            const yOffset = Math.round(this.gl.canvas.height - ((innerRenderHeight + gapY) * (row + 1) - gapY) * pixelRatio);

            this.renderCanvas(frame, xOffset, yOffset, Math.floor(frame.renderWidth), Math.floor(frame.renderHeight), channel);
        });
    };

    private updateCanvas = () => {
        AppStore.Instance.setCanvasUpdated();

        const image = this.props.image;
        const baseFrame = this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image?.store?.baseFrame : this.props.image?.store;
        const tileRenderService = baseFrame.isPreview ? PreviewWebGLService.Instance : TileWebGLService.Instance;
        const renderWidth = this.props.renderWidth || baseFrame.renderWidth;
        const renderHeight = this.props.renderHeight || baseFrame.renderHeight;
        const canvas = this.canvas;
        const numImageColumns = AppStore.Instance.imageViewConfigStore.numImageColumns;
        const numImageRows = AppStore.Instance.imageViewConfigStore.numImageRows;
        const channel = this.props.channel;

        if (!canvas || !this.gl) {
            return;
        }

        if (!tileRenderService.cmapTexture) {
            return;
        }

        if (baseFrame) {
            this.updateCanvasSize(baseFrame, renderWidth, renderHeight, numImageColumns, numImageRows);
        }

        const pixelRatio = AppStore.Instance.pixelRatio;
        const column = this.props.column;
        const row = this.props.row;
        const xOffset = column * renderWidth * pixelRatio;
        const yOffset = this.gl.canvas.height - renderHeight * (row + 1) * pixelRatio;

        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        if (image?.type === ImageType.COLOR_BLENDING) {
            ctx.globalCompositeOperation = "lighter";
        }

        const frames = this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image?.store?.frames : [this.props.image?.store];
        frames.forEach((frame, index) => {
            if (frame) {
                const histStokesIndex = frame.renderConfig.stokesIndex;
                const histChannel = frame.renderConfig.histChannel;
                if (
                    (frame.renderConfig.useCubeHistogram || frame.channel === histChannel || frame.isPreview || AppStore.Instance.channelMapStore.channelMapEnabled) &&
                    (frame.stokes === histStokesIndex || frame.polarizations.indexOf(frame.stokes) === histStokesIndex)
                ) {
                    this.updateUniforms(frame, Math.floor(frame.renderWidth), Math.floor(frame.renderHeight), this.props.pixelHighlightValue);
                    if (channel && isFinite((channel as number[]).length)) {
                        this.renderMultipleCanvas(frame);
                    } else {
                        this.renderCanvas(frame, xOffset, yOffset, renderWidth, renderHeight, frame.channel);
                    }
                }

                if (image?.type === ImageType.COLOR_BLENDING) {
                    ctx.globalAlpha = image?.store?.alpha[index];
                }

                ctx.drawImage(this.gl.canvas, column * w, row * h, w, h, 0, 0, w, h);
            }
        });
    };

    private updateCanvasSize(frame: FrameStore, renderWidth: number, renderHeight: number, numImageColumns: number, numImageRows: number) {
        const webGLService = frame.isPreview ? PreviewWebGLService.Instance : TileWebGLService.Instance;
        if (!frame) {
            return;
        }

        const appStore = AppStore.Instance;
        const requiredWidth = Math.max(1, renderWidth * appStore.pixelRatio);
        const requiredHeight = Math.max(1, renderHeight * appStore.pixelRatio);

        const gl = webGLService.gl;
        // Resize and clear the canvas if needed
        if (frame?.isRenderable && (this.canvas.width !== requiredWidth || this.canvas.height !== requiredHeight)) {
            this.canvas.width = requiredWidth;
            this.canvas.height = requiredHeight;
        }
        // Resize and clear the shared WebGL canvas if required
        webGLService.setCanvasSize(requiredWidth * numImageColumns, requiredHeight * numImageRows);

        if (gl.drawingBufferWidth !== gl.canvas.width || gl.drawingBufferHeight !== gl.canvas.height) {
            appStore.decreaseImageRatio();
        }
    }

    private updateUniforms(frame: FrameStore, renderWidth: number, renderHeight: number, pixelHighlightValue: number) {
        const appStore = AppStore.Instance;
        const webGLService = frame.isPreview ? PreviewWebGLService.Instance : TileWebGLService.Instance;
        const shaderUniforms = webGLService.shaderUniforms;
        const tileRenderService = webGLService;
        const renderConfig = frame.renderConfig;

        if (renderConfig && shaderUniforms) {
            if (renderConfig.colorMapIndex === -1) {
                tileRenderService.setCustomGradientUniforms(renderConfig.customColormapHexEnd, renderConfig.customColormapHexStart);
            } else if (renderConfig.colorMapIndex >= 79) {
                tileRenderService.setCustomGradientUniforms(renderConfig.monoColormapHex);
            }
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
            this.gl.uniform1f(shaderUniforms.CanvasWidth, renderWidth * appStore.pixelRatio);
            this.gl.uniform1f(shaderUniforms.CanvasHeight, renderHeight * appStore.pixelRatio);

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

            if (isFinite(pixelHighlightValue) && !appStore.isExportingImage) {
                this.gl.uniform1f(shaderUniforms.PixelHighlightVal, pixelHighlightValue);
            } else {
                this.gl.uniform1f(shaderUniforms.PixelHighlightVal, -RasterViewComponent.Float32Max);
            }
        }
    }

    private renderCanvas(frame: FrameStore, xOffset: number, yOffset: number, renderWidth: number, renderHeight: number, channel: number) {
        if (frame?.isRenderable) {
            const appStore = AppStore.Instance;
            const pixelRatio = devicePixelRatio * appStore.imageRatio;

            this.gl.viewport(xOffset, yOffset, renderWidth * pixelRatio, renderHeight * pixelRatio);
            this.gl.enable(GL2.DEPTH_TEST);

            // Clear a scissored rectangle limited to the current frame
            this.gl.enable(GL2.SCISSOR_TEST);
            this.gl.scissor(xOffset, yOffset, renderWidth * pixelRatio, renderHeight * pixelRatio);
            this.gl.clear(GL2.COLOR_BUFFER_BIT | GL2.DEPTH_BUFFER_BIT);
            this.gl.disable(GL2.SCISSOR_TEST);

            // Skip rendering if frame is hidden
            if (frame.renderConfig.visible) {
                this.props.image?.type === ImageType.PV_PREVIEW ? this.renderSingleTileCanvas(frame) : this.renderTiledCanvas(frame, channel);
            }
        }
    }

    private renderSingleTileCanvas(frame: FrameStore) {
        // For PV preview render
        const rasterData = frame.previewPVRasterData;
        const rasterTile = {data: rasterData, width: frame.frameInfo.fileInfoExtended.width, height: frame.frameInfo.fileInfoExtended.height, textureCoordinate: 0};
        const tile = {x: 0, y: 0, layer: 0} as TileCoordinate;

        this.renderTile(frame, tile, rasterTile, 1);
    }

    private renderTiledCanvas(frame: FrameStore, channel: number) {
        const imageSize = {x: frame.frameInfo.fileInfoExtended.width, y: frame.frameInfo.fileInfoExtended.height};
        const boundedView: FrameView = {
            xMin: Math.max(-0.5, frame.requiredFrameView.xMin),
            xMax: Math.min(frame.requiredFrameView.xMax, imageSize.x - 0.5),
            yMin: Math.max(-0.5, frame.requiredFrameView.yMin),
            yMax: Math.min(frame.requiredFrameView.yMax, imageSize.y - 0.5),
            mip: frame.requiredFrameView.mip
        };

        this.gl.activeTexture(GL2.TEXTURE0);

        const requiredTiles = GetRequiredTiles(boundedView, imageSize, {x: TILE_SIZE, y: TILE_SIZE});
        // Special case when zoomed out
        if (requiredTiles.length === 1 && requiredTiles[0].layer === 0) {
            const mip = LayerToMip(0, imageSize, {x: TILE_SIZE, y: TILE_SIZE});
            this.renderTiles(frame, requiredTiles, channel, mip, false, 3, true);
        } else {
            this.renderTiles(frame, requiredTiles, channel, boundedView.mip, false, 3, true);
        }
    }

    private renderTiles(frame: FrameStore, tiles: TileCoordinate[], channel: number, mip: number, peek: boolean = false, numPlaceholderLayersHighRes: number, renderLowRes: boolean) {
        const tileService = TileService.Instance;
        if (!tileService) {
            return;
        }

        const placeholderTileMap = new Map<number, boolean>();
        const highResPlaceholders = [];

        for (const tile of tiles) {
            const encodedCoordinate = TileCoordinate.EncodeCoordinate(tile);
            const rasterTile = tileService.getTile(encodedCoordinate, frame.frameInfo.fileId, channel, peek);
            if (rasterTile) {
                this.renderTile(frame, tile, rasterTile, mip);
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
            this.renderTiles(frame, highResPlaceholders, channel, mip / 2, true, numPlaceholderLayersHighRes - 1, false);
        }
        if (renderLowRes) {
            const placeholderTileList: TileCoordinate[] = [];
            placeholderTileMap.forEach((val, encodedTile) => placeholderTileList.push(TileCoordinate.Decode(encodedTile)));
            if (placeholderTileList.length) {
                this.renderTiles(frame, placeholderTileList, channel, mip * 2, true, 0, true);
            }
        }
    }

    private renderTile(frame: FrameStore, tile: TileCoordinate, rasterTile: RasterTile, mip: number) {
        const appStore = AppStore.Instance;
        const webGLService = frame.isPreview ? PreviewWebGLService.Instance : TileWebGLService.Instance;
        const tileService = TileService.Instance;
        const tileBasedRender = this.props.image?.type !== ImageType.PV_PREVIEW;
        const shaderUniforms = webGLService.shaderUniforms;

        if (!rasterTile) {
            return;
        }

        if (rasterTile.data && tileBasedRender) {
            tileService.uploadTileToGPU(rasterTile);
            delete rasterTile.data;
        }

        if (!tileBasedRender && rasterTile.width * rasterTile.height === rasterTile.data?.length) {
            const texture = createFP32Texture(this.gl, rasterTile.width, rasterTile.height, GL2.TEXTURE0);
            copyToFP32Texture(this.gl, texture, rasterTile.data, GL2.TEXTURE0, rasterTile.width, rasterTile.height, 0, 0);
            this.gl.bindTexture(GL2.TEXTURE_2D, texture);
            this.gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MIN_FILTER, GL2.NEAREST);
            this.gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MAG_FILTER, GL2.NEAREST);
            this.gl.uniform2f(shaderUniforms.TileTextureOffset, 0, 0);
            this.gl.uniform2f(shaderUniforms.TileTextureSize, rasterTile.width, rasterTile.height);
            this.gl.uniform2f(shaderUniforms.TextureSize, rasterTile.width, rasterTile.height);
        } else {
            const textureParameters = tileService?.getTileTextureParameters(rasterTile);
            if (textureParameters) {
                this.gl.bindTexture(GL2.TEXTURE_2D, textureParameters.texture);
                this.gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MIN_FILTER, GL2.NEAREST);
                this.gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MAG_FILTER, GL2.NEAREST);
                this.gl.uniform2f(shaderUniforms.TileTextureOffset, textureParameters.offset.x, textureParameters.offset.y);
                this.gl.uniform2f(shaderUniforms.TileTextureSize, TILE_SIZE, TILE_SIZE);
                this.gl.uniform2f(shaderUniforms.TextureSize, TEXTURE_SIZE, TEXTURE_SIZE);
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
        if (frame.spatialReference) {
            zoomFactor = frame.spatialTransform.scale;
            zoom = (frame.spatialReference.zoomLevel / appStore.pixelRatio) * zoomFactor;
        } else {
            aspectRatio = frame.aspectRatio;
            zoom = frame.zoomLevel / appStore.pixelRatio;
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
        const baseFrame = this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image?.store?.baseFrame : this.props.image?.store;

        const frames = this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image?.store?.frames : [this.props.image?.store];
        for (const frame of frames) {
            if (frame) {
                const spatialReference = frame.spatialReference || frame;
                const frameView = spatialReference.requiredFrameView;
                const currentView = spatialReference.currentFrameView;
                const colorMapping = {
                    min: frame.renderConfig.scaleMinVal,
                    max: frame.renderConfig.scaleMaxVal,
                    colorMap: frame.renderConfig.colorMapIndex,
                    customHex: frame.renderConfig.customColormapHexEnd,
                    customStartHex: frame.renderConfig.customColormapHexStart,
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
        }
        if (this.props.image?.type === ImageType.COLOR_BLENDING) {
            const alpha = this.props.image?.store?.alpha;
        }
        /* eslint-enable @typescript-eslint/no-unused-vars */

        const padding = baseFrame.overlayStore.padding;
        const className = classNames(`raster-div`, {docked: this.props.docked});

        return (
            <div className={className} style={{top: 0, left: 0}}>
                <canvas
                    className={`raster-canvas`}
                    id="raster-canvas"
                    ref={this.getRef}
                    style={{
                        top: padding.top,
                        left: padding.left,
                        width: baseFrame?.isRenderable ? this.props.renderWidth || baseFrame.renderWidth || 1 : 1,
                        height: baseFrame?.isRenderable ? this.props.renderHeight || baseFrame.renderHeight || 1 : 1
                    }}
                />
            </div>
        );
    }
}
