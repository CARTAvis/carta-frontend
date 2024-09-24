import Konva from "konva";

import {exportSvgFile} from "utilities";

import {AstSvgGenerator} from "./AstSvgGenerator";
import {KonvaSvgGenerator} from "./KonvaSvgGenerator";

export class SvgGenerator {
    regionLayerRef: Konva.Layer | null = null;

    private astSvgGenerator = new AstSvgGenerator();
    private konvaSvgGenerator = new KonvaSvgGenerator();

    setOverlayPlotFunction = (func: () => void) => {
        this.astSvgGenerator.plotFunction = func;
    };

    exportSvg = (width: number, height: number, leftPadding: number, topPadding: number) => {
        const baseOverlaySvgElement = this.astSvgGenerator.generate(width, height);

        this.konvaSvgGenerator.layerRef = this.regionLayerRef;
        const regionSvgElement = this.konvaSvgGenerator.generate(width, height, leftPadding, topPadding);

        if (baseOverlaySvgElement && regionSvgElement) {
            baseOverlaySvgElement.appendChild(regionSvgElement);
            exportSvgFile(baseOverlaySvgElement);
        }
    };
}
