// This is a component that uses rasterViewComponent to construct something on the same level as imagePanel component
import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";

import {TileWebGLService} from "services";
import {AppStore, ChannelMapOverlayStore} from "stores";
import {FrameStore} from "stores/Frame";

import {RasterViewComponent, renderCanvas, updateUniforms} from "../RasterView/RasterViewComponent";
import {RegionViewComponent} from "../RegionView/RegionViewComponent";
import { OverlayComponent } from "../Overlay/OverlayComponent";

export class ChannelMapViewComponentProps {
    docked: boolean;
    pixelHighlightValue: number;
    frame: FrameStore;
    gl: WebGL2RenderingContext;
    renderWidth: number;
    renderHeight: number;
    numImageRow: number;
    numImageColumn: number;
}

export const ChannelMapViewComponent: React.FC<ChannelMapViewComponentProps> = observer((props: ChannelMapViewComponentProps) => {
    const canvas = React.useRef<HTMLCanvasElement>();
    const gl = props.gl;
    const appStore = AppStore.Instance;
    const imageRenderWidth = props.renderWidth / props.numImageColumn;
    const imageRenderHeight = props.renderHeight / props.numImageRow;
    const overlayStore = ChannelMapOverlayStore.Instance;
    // The channel map will need multiple rasterView to render the array of channels, one overlayComponent to render the axis, one contourView

    const channelFrames = [props.frame.previewPVRasterData, props.frame.previewPVRasterData, props.frame.previewPVRasterData, props.frame.previewPVRasterData, props.frame.previewPVRasterData, props.frame.previewPVRasterData];
    const [rasterData] = React.useState<Float32Array[]>(channelFrames);
    const padding = AppStore.Instance.overlayStore.padding;
    const className = classNames("channel-map-div", {docked: props.docked});
    // Mock for raster channel image data

    // We need to import

    // React.useEffect(() => {
    //     if (canvas) {
    //         updateCanvas(props.frame, gl, canvas.current, imageRenderWidth, imageRenderHeight, props.numImageColumn, props.numImageRow, props.pixelHighlightValue, rasterData);
    //     }
    //     requestAnimationFrame(() => updateCanvas(props.frame, gl, canvas.current, imageRenderWidth, imageRenderHeight, props.numImageColumn, props.numImageRow, props.pixelHighlightValue, rasterData));
    // }, [props.frame.zoomLevel, props.frame.center]);

    return (
        <>
            {channelFrames.map((data, index) => {
                const column = index % props.numImageColumn;
                const row = Math.floor(index / props.numImageColumn);
                console.log(column, row);
                return (
                    <>
                        <RasterViewComponent
                            frame={props.frame}
                            gl={TileWebGLService.Instance.gl}
                            docked={props.docked}
                            pixelHighlightValue={props.pixelHighlightValue}
                            numImageColumns={props.numImageColumn}
                            numImageRows={props.numImageRow}
                            renderWidth={imageRenderWidth}
                            renderHeight={imageRenderHeight}
                            row={row}
                            column={column}
                            tileBasedRender={false}
                            rasterData={data}
                        />
                        <OverlayComponent frame={props.frame} overlaySettings={overlayStore} docked={props.docked} />
                        <RegionViewComponent
                            frame={props.frame}
                            width={props.renderWidth}
                            height={props.renderHeight}
                            top={0}
                            left={0}
                            onClickToCenter={null}
                            overlaySettings={appStore.overlayStore}
                            dragPanningEnabled={appStore.preferenceStore.dragPanning}
                            docked={props.docked}
                        />
                    </>
                );
            })}

            {/* <div className={className}> */}
            {/* <canvas
                    className="channel-map-canvas"
                    id="channel-map-canvas"
                    ref={ref => (canvas.current = ref)}
                    style={{
                        top: padding.top,
                        left: padding.left,
                        width: props.frame?.isRenderable ? appStore.overlayStore.fullViewWidth || 1 : 1,
                        height: props.frame?.isRenderable ? appStore.overlayStore.fullViewHeight || 1 : 1
                    }}
                /> */}
            {/* <RasterViewComponent
                        frame={frame}
                        gl={TileWebGLService.Instance.gl}
                        docked={this.props.docked}
                        pixelHighlightValue={pixelHighlightValue}
                        row={props.row}
                        column={props.column}
                        tileBasedRender={!frame.isPreview}
                    /> */}
            {/* </div> */}
        </>
    );
});

// function updateCanvas(frame: FrameStore, gl: WebGL2RenderingContext, canvas: HTMLCanvasElement, renderWidth: number, renderHeight: number, numImageColumn: number, numImageRow: number, pixelHighlightValue: number, rasterData: Float32Array[]) {

//     const appStore = AppStore.Instance;
//     const pixelRatio = devicePixelRatio * appStore.imageRatio;

//     const tileRenderService = TileWebGLService.Instance;

//     canvas.width = renderWidth * numImageColumn;
//     canvas.height = renderHeight * numImageRow;

//     console.log(canvas.width, canvas.height)

//     tileRenderService.setCanvasSize(renderWidth * numImageColumn, renderWidth * numImageRow);

//     updateUniforms(frame, gl, tileRenderService.shaderUniforms, renderWidth, renderHeight, pixelHighlightValue);

//     rasterData.forEach((data, index) => {
//         const column = index % numImageColumn;
//         const row = Math.floor(index / numImageColumn);

//         // const column = 0;
//         // const row = 0;
//         // const data = frame.previewPVRasterData;

//         console.log(column, row)
//         const xOffset = renderWidth * column;
//         const yOffset = canvas.height - (renderHeight) * (row + 1);
//         console.log(xOffset, yOffset, gl.canvas.height, renderHeight, pixelRatio)

//         renderCanvas(frame, gl, xOffset, yOffset, renderWidth / pixelRatio, renderHeight / pixelRatio, false, data)
//         const ctx = canvas.getContext("2d");
//         const w = canvas.width;
//         const h = canvas.height;
//         ctx.clearRect(0, 0, w, h);
//         ctx.drawImage(gl.canvas, 0, 0, w, h);
//     })

// }
