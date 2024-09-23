import {exportSvgFile} from "utilities";

import {AstSvgGenerator} from "./AstSvgGenerator";

export class SvgGenerator {
    private astSvgGenerator = new AstSvgGenerator();

    setOverlayPlotFunction = (func: (canvasContext: CanvasRenderingContext2D, canvasHeight: number) => void) => {
        this.astSvgGenerator.plotFunction = func;
    };

    exportSvg = (width, height) => {
        const svgElement = this.astSvgGenerator.generate(width, height);

        if (svgElement) {
            exportSvgFile(svgElement);
        }
    };
}
