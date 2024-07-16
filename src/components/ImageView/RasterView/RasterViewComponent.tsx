import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import {Subscription} from "rxjs";
import tinycolor from "tinycolor2";

import {FrameView, ImageItem, ImageType, Point2D, TileCoordinate} from "models";
import {RasterTile, TEXTURE_SIZE, TILE_SIZE, TileService, TileWebGLService} from "services";
import {AppStore, OverlayStore} from "stores";
import {FrameStore} from "stores/Frame";
import {add2D, copyToFP32Texture, createFP32Texture, getColorForTheme, GetRequiredTiles, GL2, LayerToMip, scale2D, smoothStep} from "utilities";

import "./RasterViewComponent.scss";

export class RasterViewComponentProps {
    docked: boolean;
    overlayStore: OverlayStore;
    image: ImageItem;
    pixelHighlightValue: number;
    top?: number;
    left?: number;
    row: number;
    column: number;
    webGLService: TileWebGLService;
    tileService: TileService;
    tileBasedRender: boolean;
    rasterData?: Float32Array;
    channel?: number; // if channel is defined, we will fetch tiles info of this channel number instead of frame.channel
}

const Float32Max = 3.402823466e38;

@observer
export class RasterViewComponent extends React.Component<RasterViewComponentProps> {
    private sub: Subscription;
    private canvas: HTMLCanvasElement;

    componentDidMount() {
        const appStore = AppStore.Instance;
        const baseFrame = this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image?.store?.baseFrame : this.props.image?.store;

        if (this.props.tileBasedRender) {
            if (this.canvas) {
                this.updateCanvas(
                    this.props.image,
                    this.props.webGLService,
                    this.props.tileService,
                    this.canvas,
                    this.props.overlayStore,
                    this.props.column,
                    this.props.row,
                    appStore.imageViewConfigStore.numImageColumns,
                    appStore.imageViewConfigStore.numImageRows,
                    this.props.pixelHighlightValue,
                    this.props.tileBasedRender,
                    this.props.channel || baseFrame.channel,
                    this.props.rasterData
                );
            }

            this.sub = this.props.tileService.tileStream.subscribe(tileMessage => {
                // sometimes the renderHeight is 0, and still figuring out why
                ((!isFinite(this.props.channel) && (!AppStore.Instance.preferenceStore.channelMapEnabled || (this.props.image.store as FrameStore).isPreview)) || tileMessage.channel === this.props.channel) &&
                    requestAnimationFrame(() =>
                        this.updateCanvas(
                            this.props.image,
                            this.props.webGLService,
                            this.props.tileService,
                            this.canvas,
                            this.props.overlayStore,
                            this.props.column,
                            this.props.row,
                            appStore.imageViewConfigStore.numImageColumns,
                            appStore.imageViewConfigStore.numImageRows,
                            this.props.pixelHighlightValue,
                            this.props.tileBasedRender,
                            this.props.channel || baseFrame.channel,
                            this.props.rasterData
                        )
                    );
            });
        }
        // return () => {
        //     console.log("disarming");
        //     sub.current && sub.current.unsubscribe(); // I realized that we need to unsubscribe to streams, if not it will still exist in memory somewhere. Could this be related to any bug?
        // };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }

    componentWillUnmount(): void {
        this.sub && this.sub.unsubscribe();
    }

    componentDidUpdate() {
        const appStore = AppStore.Instance;
        const baseFrame = this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image?.store?.baseFrame : this.props.image?.store;
        requestAnimationFrame(() =>
            this.updateCanvas(
                this.props.image,
                this.props.webGLService,
                this.props.tileService,
                this.canvas,
                this.props.overlayStore,
                this.props.column,
                this.props.row,
                appStore.imageViewConfigStore.numImageColumns,
                appStore.imageViewConfigStore.numImageRows,
                this.props.pixelHighlightValue,
                this.props.tileBasedRender,
                this.props.channel || baseFrame.channel,
                this.props.rasterData
            )
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }
    // , [
    //     this.props.channel,
    //     this.props.column,
    //     baseFrame,
    //     this.props.overlayStore,
    //     this.props.rasterData,
    //     this.props.row,
    //     this.props.tileBasedRender,
    //     this.props.tileService,
    //     this.props.webGLService,
    //     baseFrame.zoomLevel,
    //     baseFrame.center,
    //     this.props.pixelHighlightValue,
    //     baseFrame.requiredFrameView,
    //     baseFrame.spatialReference,
    //     baseFrame?.renderConfig.scaleMinVal,
    //     baseFrame?.renderConfig.scaleMaxVal,
    //     baseFrame?.renderConfig.colorMapIndex,
    //     baseFrame?.renderConfig.contrast,
    //     baseFrame?.renderConfig.bias
    //     // appStore.preferenceStore?.useSmoothedBiasContrast,
    //     // frame?.renderConfig.scaling,
    //     // frame?.renderConfig.gamma,
    //     // frame?.renderConfig.alpha,
    //     // frame?.renderConfig.inverted,
    //     // frame?.renderConfig.visible,
    //     // appStore.preferenceStore.nanColorHex,
    //     // appStore.preferenceStore.nanAlpha,
    //     // appStore.preferenceStore.pixelGridVisible,
    //     // appStore.imageRatio,
    //     // frame?.spatialReference.requiredFrameView,
    //     // frame?.spatialReference.currentFrameView
    // ]);

    private updateCanvas = (
        image: ImageItem,
        webGLService: TileWebGLService,
        tileService: TileService,
        canvas: HTMLCanvasElement,
        overlayStore: OverlayStore,
        column: number,
        row: number,
        numImageColumns: number,
        numImageRows: number,
        pixelHighlightValue: number,
        tileBasedRender: boolean,
        channel: number,
        rasterData?: Float32Array
    ) => {
        AppStore.Instance.setCanvasUpdated();

        const tileRenderService = webGLService;
        const gl = webGLService.gl;
        // if (frame && canvas && gl && tileRenderService.cmapTexture) {
        //     const histStokesIndex = frame.renderConfig.stokesIndex;
        //     const histChannel = frame.renderConfig.histogram ? frame.renderConfig.histChannel : undefined;
        //     if ((frame.renderConfig.useCubeHistogram || frame.channel === histChannel || frame.isPreview) && (frame.stokes === histStokesIndex || frame.polarizations.indexOf(frame.stokes) === histStokesIndex)) {
        const pixelRatio = devicePixelRatio * AppStore.Instance.imageRatio;

        const renderWidth = overlayStore.renderWidth;
        const renderHeight = overlayStore.renderHeight;
        const xOffset = column * renderWidth * pixelRatio;
        const yOffset = gl.canvas.height - renderHeight * (row + 1) * pixelRatio;

        //         updateCanvasSize(frame, webGLService, canvas, renderWidth, renderHeight, numImageColumns, numImageRows);
        //         updateUniforms(frame, webGLService, renderWidth, renderHeight, pixelHighlightValue);
        //         renderCanvas(frame, webGLService, tileService, xOffset, yOffset, renderWidth, renderHeight, tileBasedRender, channel, rasterData);

        if (!canvas || !gl) {
            return;
        }

        // const tileRenderService = image?.type === ImageType.PV_PREVIEW ? PreviewWebGLService.Instance : TileWebGLService.Instance;
        if (!tileRenderService.cmapTexture) {
            return;
        }

        const baseFrame = image?.type === ImageType.COLOR_BLENDING ? image?.store?.baseFrame : image?.store;
        if (baseFrame) {
            this.updateCanvasSize(baseFrame, webGLService, canvas, renderWidth, renderHeight, numImageColumns, numImageRows);
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
                if ((frame.renderConfig.useCubeHistogram || frame.channel === histChannel || frame.isPreview) && (frame.stokes === histStokesIndex || frame.polarizations.indexOf(frame.stokes) === histStokesIndex)) {
                    this.updateUniforms(frame, webGLService, renderWidth, renderHeight, pixelHighlightValue);
                    this.renderCanvas(frame, webGLService, tileService, xOffset, yOffset, renderWidth, renderHeight, tileBasedRender, channel, rasterData);
                }

                if (image?.type === ImageType.COLOR_BLENDING) {
                    ctx.globalAlpha = image?.store?.alpha[index];
                }

                ctx.drawImage(gl.canvas, column * w, row * h, w, h, 0, 0, w, h);
            }
        });
        // }
        // draw in 2d canvas
        // const ctx = canvas.getContext("2d");
        // const w = canvas.width;
        // const h = canvas.height;
        // ctx.clearRect(0, 0, w, h);
        // ctx.drawImage(gl.canvas, column * w, row * h, w, h, 0, 0, w, h);
        // }
    };

    private updateCanvasSize(frame: FrameStore, webGLService: TileWebGLService, canvas: HTMLCanvasElement, renderWidth: number, renderHeight: number, numImageColumns: number, numImageRows: number) {
        if (!frame) {
            return;
        }

        const appStore = AppStore.Instance;
        const pixelRatio = devicePixelRatio * appStore.imageRatio;
        const requiredWidth = Math.max(1, renderWidth * pixelRatio);
        const requiredHeight = Math.max(1, renderHeight * pixelRatio);

        const tileRenderService = webGLService;
        const gl = webGLService.gl;
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

    public updateUniforms(frame: FrameStore, webGLService: TileWebGLService, renderWidth: number, renderHeight: number, pixelHighlightValue: number) {
        const appStore = AppStore.Instance;
        const renderConfig = frame.renderConfig;
        const pixelRatio = devicePixelRatio * appStore.imageRatio;
        const gl = webGLService.gl;
        const shaderUniforms = webGLService.shaderUniforms;

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

    public renderCanvas(
        frame: FrameStore,
        webGLService: TileWebGLService,
        tileService: TileService,
        xOffset: number,
        yOffset: number,
        renderWidth: number,
        renderHeight: number,
        tileBasedRender: boolean,
        channel: number,
        rasterData?: Float32Array
    ) {
        // Only clear and render if we're in animation or tiled mode
        if (frame?.isRenderable) {
            const appStore = AppStore.Instance;
            const pixelRatio = devicePixelRatio * appStore.imageRatio;
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
                tileBasedRender ? this.renderTiledCanvas(frame, webGLService, channel, tileService) : this.renderRasterCanvas(frame, webGLService, rasterData);
            }
        }
    }

    private renderRasterCanvas(frame: FrameStore, webGLService: TileWebGLService, rasterData: Float32Array) {
        // For PV preview render
        //Preview frame is always rendered with one tile
        const rasterTile = {data: rasterData, width: frame.frameInfo.fileInfoExtended.width, height: frame.frameInfo.fileInfoExtended.height, textureCoordinate: 0};
        const tile = {x: 0, y: 0, layer: 0} as TileCoordinate;

        this.renderTile(frame, webGLService, tile, rasterTile, frame.requiredFrameView.mip, false);
    }

    private renderTiledCanvas(frame: FrameStore, webGLService: TileWebGLService, channel: number, tileService: TileService) {
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
            this.renderTiles(frame, webGLService, requiredTiles, channel, mip, false, 3, true, tileService);
        } else {
            this.renderTiles(frame, webGLService, requiredTiles, channel, boundedView.mip, false, 3, true, tileService);
        }
    }

    private renderTiles(frame: FrameStore, webGLService: TileWebGLService, tiles: TileCoordinate[], channel: number, mip: number, peek: boolean = false, numPlaceholderLayersHighRes: number, renderLowRes: boolean, tileService: TileService) {
        if (!tileService) {
            return;
        }

        const placeholderTileMap = new Map<number, boolean>();
        const highResPlaceholders = [];

        for (const tile of tiles) {
            const encodedCoordinate = TileCoordinate.EncodeCoordinate(tile);
            const rasterTile = tileService.getTile(encodedCoordinate, frame.frameInfo.fileId, channel, peek);
            if (rasterTile) {
                this.renderTile(frame, webGLService, tile, rasterTile, mip, true, tileService);
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
            this.renderTiles(frame, webGLService, highResPlaceholders, channel, mip / 2, true, numPlaceholderLayersHighRes - 1, false, tileService);
        }
        if (renderLowRes) {
            const placeholderTileList: TileCoordinate[] = [];
            placeholderTileMap.forEach((val, encodedTile) => placeholderTileList.push(TileCoordinate.Decode(encodedTile)));
            if (placeholderTileList.length) {
                this.renderTiles(frame, webGLService, placeholderTileList, channel, mip * 2, true, 0, true, tileService);
            }
        }
    }

    public renderTile(frame: FrameStore, webGLService: TileWebGLService, tile: TileCoordinate, rasterTile: RasterTile, mip: number, tileBasedRender: boolean, tileService?: TileService) {
        const appStore = AppStore.Instance;
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

    render() {
        // dummy values to trigger React's componentDidUpdate()
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const appStore = AppStore.Instance;
        const baseFrame = this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image?.store?.baseFrame : this.props.image?.store;
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

        const padding = this.props.overlayStore.padding;
        const className = classNames(`raster-div`, {docked: this.props.docked});

        return (
            <div className={className} style={{top: this.props.top || 0, left: this.props.left || 0}}>
                <canvas
                    className={`raster-canvas`}
                    id="raster-canvas"
                    ref={ref => (this.canvas = ref)}
                    style={{
                        top: padding.top,
                        left: padding.left,
                        width: baseFrame?.isRenderable ? this.props.overlayStore.renderWidth || 1 : 1,
                        height: baseFrame?.isRenderable ? this.props.overlayStore.renderHeight || 1 : 1
                    }}
                />
            </div>
        );
    }
}
