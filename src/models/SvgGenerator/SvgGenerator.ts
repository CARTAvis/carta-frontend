import Konva from "konva";

import {exportSvgFile} from "utilities";

import {AstSvgGenerator} from "./AstSvgGenerator";
import {KonvaSvgGenerator} from "./KonvaSvgGenerator";

export class SvgGenerator {
    regionLayerRef: Konva.Layer | null = null;
    colorbarLayerRef: Konva.Layer | null = null;

    private astSvgGenerator = new AstSvgGenerator();
    private konvaSvgGenerator = new KonvaSvgGenerator();

    setOverlayPlotFunction = (func: () => void) => {
        this.astSvgGenerator.plotFunction = func;
    };

    exportSvg = (width: number, height: number, leftPadding: number, topPadding: number) => {
        const baseOverlaySvgElement = this.astSvgGenerator.generate(width, height);

        this.konvaSvgGenerator.layerRef = this.regionLayerRef;
        const regionSvgElement = this.konvaSvgGenerator.generate(width, height, leftPadding, topPadding);

        this.konvaSvgGenerator.layerRef = this.colorbarLayerRef;
        const renderWidth = (this.regionLayerRef?.size().width ?? 0) * (this.regionLayerRef?.canvas.pixelRatio ?? 1);
        const colorbarSvgElement = this.konvaSvgGenerator.generate(width, height, renderWidth + leftPadding, 0);

        if (baseOverlaySvgElement && regionSvgElement && colorbarSvgElement) {
            baseOverlaySvgElement.appendChild(regionSvgElement);
            baseOverlaySvgElement.appendChild(colorbarSvgElement);
            exportSvgFile(baseOverlaySvgElement);
        }
    };
}
