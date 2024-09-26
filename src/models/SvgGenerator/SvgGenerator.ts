import Konva from "konva";

import {Point2D, TileCoordinate} from "models";
import {RasterTile} from "services";
import {exportSvgFile} from "utilities";

import {AstSvgGenerator} from "./AstSvgGenerator";
import {KonvaSvgGenerator} from "./KonvaSvgGenerator";
import {WebglSvgGenerator} from "./WebglSvgGenerator";

export class SvgGenerator {
    regionLayerRef: Konva.Layer | null = null;
    colorbarLayerRef: Konva.Layer | null = null;

    private astSvgGenerator = new AstSvgGenerator();
    private konvaSvgGenerator = new KonvaSvgGenerator();
    private webglSvgGenerator = new WebglSvgGenerator();

    setOverlayPlotFunction = (func: () => void) => {
        this.astSvgGenerator.plotFunction = func;
    };

    setRasterTileConfig = (requiredTiles: TileCoordinate[], getTile: (encodedCoordinate: number) => RasterTile) => {
        this.webglSvgGenerator.requiredTiles = requiredTiles;
        this.webglSvgGenerator.getTile = getTile;
    };

    setImageViewConfig = (xMin: number, xMax: number, yMin: number, yMax: number, mip: number, rotationConfig: {rotationOrigin: Point2D; rotationAngle: number}) => {
        this.webglSvgGenerator.xMin = xMin;
        this.webglSvgGenerator.xMax = xMax;
        this.webglSvgGenerator.yMin = yMin;
        this.webglSvgGenerator.yMax = yMax;
        this.webglSvgGenerator.mip = mip;
        this.webglSvgGenerator.rotationConfig = rotationConfig;
    };

    setRasterRenderConfig = (colorscaleArray: (number | string)[], scaleMinVal: number, scaleMaxVal: number, nanColorHex: string) => {
        this.webglSvgGenerator.colorscaleArray = colorscaleArray;
        this.webglSvgGenerator.scaleMinVal = scaleMinVal;
        this.webglSvgGenerator.scaleMaxVal = scaleMaxVal;
        this.webglSvgGenerator.nanColorHex = nanColorHex;
    };

    setContourData = (contourData: Map<number, Float32Array[]>) => {
        this.webglSvgGenerator.contourData = contourData;
    };

    setContourRenderConfig = (width: number, color: string) => {
        this.webglSvgGenerator.contourWidth = width;
        this.webglSvgGenerator.contourColor = color;
    };

    exportSvg = async (width: number, height: number, topPadding: number, leftPadding: number, bottomPadding: number, rightPadding: number) => {
        const baseOverlaySvgElement = this.astSvgGenerator.generate(width, height);

        this.konvaSvgGenerator.layerRef = this.regionLayerRef;
        const regionSvgElement = this.konvaSvgGenerator.generate(width, height, leftPadding, topPadding);

        this.konvaSvgGenerator.layerRef = this.colorbarLayerRef;
        const pixelRatio = this.colorbarLayerRef?.canvas.pixelRatio ?? 1;
        const leftOffset = this.colorbarLayerRef?.getStage().getAttr("container").offsetLeft ?? 0;
        const topOffset = this.colorbarLayerRef?.getStage().getAttr("container").offsetTop ?? 0;
        const colorbarSvgElement = this.konvaSvgGenerator.generate(width, height, leftOffset * pixelRatio, topOffset * pixelRatio);

        const imageSvgElement = await this.webglSvgGenerator.generate(width, height, topPadding, leftPadding, bottomPadding, rightPadding);

        if (baseOverlaySvgElement && regionSvgElement && colorbarSvgElement && imageSvgElement) {
            baseOverlaySvgElement.appendChild(regionSvgElement);
            baseOverlaySvgElement.appendChild(colorbarSvgElement);

            const backgroundElement = baseOverlaySvgElement.querySelector("rect");
            backgroundElement?.insertAdjacentElement("afterend", imageSvgElement);

            exportSvgFile(baseOverlaySvgElement);
        }
    };
}
