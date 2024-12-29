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
    renderWidth?: number;
    renderHeight?: number;
    left?: number;
    row: number;
    column: number;
    tileBasedRender: boolean;
    rasterData?: Float32Array;
    channel?: number[];
}

const Float32Max = 3.402823466e38;

@observer
export class RasterViewComponent extends React.Component<RasterViewComponentProps> {
    private sub: Subscription;
    private canvas: HTMLCanvasElement;

    componentDidMount() {
        if (this.props.tileBasedRender) {
            if (this.canvas) {
                this.updateCanvas();
            }
        }

        this.sub = TileService.Instance.tileStream.subscribe(tileMessage => {
            ((!isFinite(this.props.channel?.length) && (!AppStore.Instance.channelMapStore.channelMapEnabled || (this.props.image.store as FrameStore).isPreview)) || this.props.channel.includes(tileMessage.channel)) &&
                requestAnimationFrame(() => this.updateCanvas());
        });
    }

    componentWillUnmount(): void {
        this.sub && this.sub.unsubscribe();
    }
    componentDidUpdate() {
        requestAnimationFrame(() => this.updateCanvas());
    }

    private renderMultipleCanvas = () => {
        const canvas = this.canvas;
        const image = this.props.image;
        const frame = image?.type === ImageType.COLOR_BLENDING ? image?.store?.baseFrame : image?.store;
        const webGLService = frame.isPreview ? PreviewWebGLService.Instance : TileWebGLService.Instance;
        const channels = this.props.channel;
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        webGLService.gl.clear(GL2.COLOR_BUFFER_BIT | GL2.DEPTH_BUFFER_BIT);

        if (!channels.length) {
            return;
        }

        channels.forEach((channel, index) => {
            const appStore = AppStore.Instance;
            const channelMapStore = appStore.channelMapStore;
            const overlayStore = appStore.overlayStore;
            const column = index % channelMapStore.numColumns;
            const row = Math.floor(index / channelMapStore.numColumns);

            const pixelRatio = devicePixelRatio * AppStore.Instance.imageRatio;
            let width = Math.floor(w / pixelRatio / channelMapStore.numColumns);
            let height = Math.floor(h / pixelRatio / channelMapStore.numRows);

            let xOffset = column * width * pixelRatio;
            let yOffset = webGLService.gl.canvas.height - height * (row + 1) * pixelRatio;
            this.renderCanvas(xOffset, yOffset + overlayStore.base * pixelRatio, width - overlayStore.base, height - overlayStore.base, channel);
        });
    };

    private updateCanvas = () => {
        AppStore.Instance.setCanvasUpdated();

        const image = this.props.image;
        const baseFrame = image?.type === ImageType.COLOR_BLENDING ? image?.store?.baseFrame : image?.store;
        const tileRenderService = baseFrame.isPreview ? PreviewWebGLService.Instance : TileWebGLService.Instance;
        const gl = tileRenderService.gl;
        const pixelRatio = devicePixelRatio * AppStore.Instance.imageRatio;
        const overlayStore = AppStore.Instance.overlayStore;
        const renderWidth = this.props.renderWidth || overlayStore.renderWidth;
        const renderHeight = this.props.renderHeight || overlayStore.renderHeight;
        const column = this.props.column;
        const row = this.props.row;
        const xOffset = column * renderWidth * pixelRatio;
        const yOffset = gl.canvas.height - renderHeight * (row + 1) * pixelRatio;
        const canvas = this.canvas;
        const numImageColumns = AppStore.Instance.imageViewConfigStore.numImageColumns;
        const numImageRows = AppStore.Instance.imageViewConfigStore.numImageRows;
        const channel = this.props.channel;

        if (!canvas || !gl) {
            return;
        }

        if (!tileRenderService.cmapTexture) {
            return;
        }

        if (baseFrame) {
            this.updateCanvasSize(canvas, renderWidth, renderHeight, numImageColumns, numImageRows);
        }

        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        if (image?.type === ImageType.COLOR_BLENDING) {
            ctx.globalCompositeOperation = "lighter";
        }

        const frames = image?.type === ImageType.COLOR_BLENDING ? image?.store?.frames : [image?.store];
        frames.forEach((frame, index) => {
            if (frame) {
                const histStokesIndex = frame.renderConfig.stokesIndex;
                const histChannel = frame.renderConfig.histogram ? frame.renderConfig.histChannel : undefined;
                if (
                    (frame.renderConfig.useCubeHistogram || frame.channel === histChannel || frame.isPreview || (AppStore.Instance.channelMapStore.channelMapEnabled && frame.renderConfig.channelMapHistogram)) &&
                    (frame.stokes === histStokesIndex || frame.polarizations.indexOf(frame.stokes) === histStokesIndex)
                ) {
                    this.updateUniforms(overlayStore.renderWidth, overlayStore.renderHeight, this.props.pixelHighlightValue);
                    if (channel && isFinite((channel as number[]).length)) {
                        this.renderMultipleCanvas();
                    } else {
                        this.renderCanvas(xOffset, yOffset, renderWidth, renderHeight, frame.channel);
                    }
                }

                if (image?.type === ImageType.COLOR_BLENDING) {
                    ctx.globalAlpha = image?.store?.alpha[index];
                }

                ctx.drawImage(gl.canvas, column * w, row * h, w, h, 0, 0, w, h);
            }
        });
    };

    private updateCanvasSize(canvas: HTMLCanvasElement, renderWidth: number, renderHeight: number, numImageColumns: number, numImageRows: number) {
        const image = this.props.image;
        const frame = image?.type === ImageType.COLOR_BLENDING ? image?.store?.baseFrame : image?.store;
        const webGLService = frame.isPreview ? PreviewWebGLService.Instance : TileWebGLService.Instance;
        if (!frame) {
            return;
        }

        const appStore = AppStore.Instance;
        const requiredWidth = Math.max(1, renderWidth * appStore.pixelRatio);
        const requiredHeight = Math.max(1, renderHeight * appStore.pixelRatio);

        const gl = webGLService.gl;
        // Resize and clear the canvas if needed
        if (frame?.isRenderable && (canvas.width !== requiredWidth || canvas.height !== requiredHeight)) {
            canvas.width = requiredWidth;
            canvas.height = requiredHeight;
        }
        // Resize and clear the shared WebGL canvas if required
        webGLService.setCanvasSize(requiredWidth * numImageColumns, requiredHeight * numImageRows);

        if (gl.drawingBufferWidth !== gl.canvas.width || gl.drawingBufferHeight !== gl.canvas.height) {
            appStore.decreaseImageRatio();
        }
    }

    public updateUniforms(renderWidth: number, renderHeight: number, pixelHighlightValue: number) {
        const appStore = AppStore.Instance;
        const image = this.props.image;
        const frame = image?.type === ImageType.COLOR_BLENDING ? image?.store?.baseFrame : image?.store;
        const webGLService = frame.isPreview ? PreviewWebGLService.Instance : TileWebGLService.Instance;
        const shaderUniforms = webGLService.shaderUniforms;
        const tileRenderService = webGLService;
        const renderConfig = frame.renderConfig;
        const gl = webGLService.gl;

        if (renderConfig && shaderUniforms) {
            if (renderConfig.colorMapIndex === -1) {
                tileRenderService.setCustomGradientUniforms(renderConfig.customColormapHexEnd, renderConfig.customColormapHexStart);
            } else if (renderConfig.colorMapIndex >= 79) {
                tileRenderService.setCustomGradientUniforms(renderConfig.monoColormapHex);
            }
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
            gl.uniform1f(shaderUniforms.CanvasWidth, renderWidth * appStore.pixelRatio);
            gl.uniform1f(shaderUniforms.CanvasHeight, renderHeight * appStore.pixelRatio);

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

    public renderCanvas(
        // frame: FrameStore,
        // webGLService: TileWebGLService,
        // tileService: TileService,
        xOffset: number,
        yOffset: number,
        renderWidth: number,
        renderHeight: number,
        // tileBasedRender: boolean,
        channel: number
        // rasterData?: Float32Array
    ) {
        const image = this.props.image;
        const frame = image?.type === ImageType.COLOR_BLENDING ? image?.store?.baseFrame : image?.store;
        if (frame?.isRenderable) {
            const appStore = AppStore.Instance;
            const pixelRatio = devicePixelRatio * appStore.imageRatio;
            const webGLService = frame.isPreview ? PreviewWebGLService.Instance : TileWebGLService.Instance;
            const gl = webGLService.gl;

            gl.viewport(xOffset, yOffset, renderWidth * pixelRatio, renderHeight * pixelRatio);
            gl.enable(GL2.DEPTH_TEST);

            // Clear a scissored rectangle limited to the current frame
            gl.enable(GL2.SCISSOR_TEST);
            gl.scissor(xOffset, yOffset, renderWidth * pixelRatio, renderHeight * pixelRatio);
            gl.clear(GL2.COLOR_BUFFER_BIT | GL2.DEPTH_BUFFER_BIT);
            gl.disable(GL2.SCISSOR_TEST);

            // Skip rendering if frame is hidden
            if (frame.renderConfig.visible) {
                this.props.tileBasedRender ? this.renderTiledCanvas(channel) : this.renderRasterCanvas();
            }
        }
    }

    private renderRasterCanvas() {
        // For PV preview render
        const image = this.props.image;
        const frame = image?.type === ImageType.COLOR_BLENDING ? image?.store?.baseFrame : image?.store;
        const rasterData = this.props.rasterData;
        const rasterTile = {data: rasterData, width: frame.frameInfo.fileInfoExtended.width, height: frame.frameInfo.fileInfoExtended.height, textureCoordinate: 0};
        const tile = {x: 0, y: 0, layer: 0} as TileCoordinate;

        this.renderTile(tile, rasterTile, frame.requiredFrameView.mip);
    }

    private renderTiledCanvas(channel: number) {
        const image = this.props.image;
        const frame = image?.type === ImageType.COLOR_BLENDING ? image?.store?.baseFrame : image?.store;
        const webGLService = frame.isPreview ? PreviewWebGLService.Instance : TileWebGLService.Instance;
        const imageSize = {x: frame.frameInfo.fileInfoExtended.width, y: frame.frameInfo.fileInfoExtended.height};
        const boundedView: FrameView = {
            xMin: Math.max(0, frame.requiredFrameView.xMin),
            xMax: Math.min(frame.requiredFrameView.xMax, imageSize.x),
            yMin: Math.max(0, frame.requiredFrameView.yMin),
            yMax: Math.min(frame.requiredFrameView.yMax, imageSize.y),
            mip: frame.requiredFrameView.mip
        };

        webGLService.gl.activeTexture(GL2.TEXTURE0);

        const requiredTiles = GetRequiredTiles(boundedView, imageSize, {x: TILE_SIZE, y: TILE_SIZE});
        // Special case when zoomed out
        if (requiredTiles.length === 1 && requiredTiles[0].layer === 0) {
            const mip = LayerToMip(0, imageSize, {x: TILE_SIZE, y: TILE_SIZE});
            this.renderTiles(requiredTiles, channel, mip, false, 3, true);
        } else {
            this.renderTiles(requiredTiles, channel, boundedView.mip, false, 3, true);
        }
    }

    private renderTiles(tiles: TileCoordinate[], channel: number, mip: number, peek: boolean = false, numPlaceholderLayersHighRes: number, renderLowRes: boolean) {
        const tileService = TileService.Instance;
        if (!tileService) {
            return;
        }

        const placeholderTileMap = new Map<number, boolean>();
        const highResPlaceholders = [];

        for (const tile of tiles) {
            const encodedCoordinate = TileCoordinate.EncodeCoordinate(tile);
            const image = this.props.image;
            const frame = image?.type === ImageType.COLOR_BLENDING ? image?.store?.baseFrame : image?.store;
            const rasterTile = tileService.getTile(encodedCoordinate, frame.frameInfo.fileId, channel, peek);
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
            this.renderTiles(highResPlaceholders, channel, mip / 2, true, numPlaceholderLayersHighRes - 1, false);
        }
        if (renderLowRes) {
            const placeholderTileList: TileCoordinate[] = [];
            placeholderTileMap.forEach((val, encodedTile) => placeholderTileList.push(TileCoordinate.Decode(encodedTile)));
            if (placeholderTileList.length) {
                this.renderTiles(placeholderTileList, channel, mip * 2, true, 0, true);
            }
        }
    }

    public renderTile(tile: TileCoordinate, rasterTile: RasterTile, mip: number) {
        const appStore = AppStore.Instance;
        const image = this.props.image;
        const frame = image?.type === ImageType.COLOR_BLENDING ? image?.store?.baseFrame : image?.store;
        const webGLService = frame.isPreview ? PreviewWebGLService.Instance : TileWebGLService.Instance;
        const tileService = TileService.Instance;
        const tileBasedRender = this.props.tileBasedRender;
        const shaderUniforms = webGLService.shaderUniforms;
        const gl = webGLService.gl;

        if (!rasterTile) {
            return;
        }

        if (rasterTile.data && tileBasedRender) {
            tileService.uploadTileToGPU(rasterTile, gl);
            delete rasterTile.data;
        }

        if (!tileBasedRender && rasterTile.width * rasterTile.height === rasterTile.data?.length) {
            const texture = createFP32Texture(gl, rasterTile.width, rasterTile.height, GL2.TEXTURE0);
            copyToFP32Texture(gl, texture, rasterTile.data, GL2.TEXTURE0, rasterTile.width, rasterTile.height, 0, 0);
            gl.bindTexture(GL2.TEXTURE_2D, texture);
            gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MIN_FILTER, GL2.NEAREST);
            gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MAG_FILTER, GL2.NEAREST);
            gl.uniform2f(shaderUniforms.TileTextureOffset, 0, 0);
            gl.uniform2f(shaderUniforms.TileTextureSize, rasterTile.width, rasterTile.height);
            gl.uniform2f(shaderUniforms.TextureSize, rasterTile.width, rasterTile.height);
        } else {
            const textureParameters = tileService?.getTileTextureParameters(rasterTile);
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

    private getRef = ref => {
        this.canvas = ref;
    };

    render() {
        // dummy values to trigger React's componentDidUpdate()
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const appStore = AppStore.Instance;
        const image = this.props.image;
        const baseFrame = image?.type === ImageType.COLOR_BLENDING ? image?.store?.baseFrame : image?.store;
        if (baseFrame) {
            const spatialReference = baseFrame.spatialReference || baseFrame;
            const frameView = spatialReference.requiredFrameView;
            const currentView = spatialReference.currentFrameView;

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
        }
        /* eslint-enable @typescript-eslint/no-unused-vars */

        const padding = appStore.overlayStore.padding;
        const className = classNames(`raster-div`, {docked: this.props.docked});

        return (
            <div className={className} style={{top: 0, left: 0}}>
                <canvas
                    className={`raster-canvas`}
                    id="raster-canvas"
                    ref={this.getRef}
                    style={{
                        top: padding.top,
                        left: this.props.left ?? padding.left,
                        width: baseFrame?.isRenderable ? this.props.renderWidth || appStore.overlayStore.renderWidth || 1 : 1,
                        height: baseFrame?.isRenderable ? this.props.renderHeight || appStore.overlayStore.renderHeight || 1 : 1
                    }}
                />
            </div>
        );
    }
}
