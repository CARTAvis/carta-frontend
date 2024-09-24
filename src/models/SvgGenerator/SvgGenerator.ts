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
        const pixelRatio = this.colorbarLayerRef?.canvas.pixelRatio ?? 1;
        const leftOffset = this.colorbarLayerRef?.getStage().getAttr("container").offsetLeft ?? 0;
        const topOffset = this.colorbarLayerRef?.getStage().getAttr("container").offsetTop ?? 0;
        const colorbarSvgElement = this.konvaSvgGenerator.generate(width, height, leftOffset * pixelRatio, topOffset * pixelRatio);

        if (baseOverlaySvgElement && regionSvgElement && colorbarSvgElement) {
            baseOverlaySvgElement.appendChild(regionSvgElement);
            baseOverlaySvgElement.appendChild(colorbarSvgElement);
            exportSvgFile(baseOverlaySvgElement);
        }
    };
}
