import {exportSvgFile} from "utilities";

import {AstSvgGenerator} from "./AstSvgGenerator";

export class SvgGenerator {
    private astSvgGenerator = new AstSvgGenerator();

    exportSvg = (width, height) => {
        const svgElement = this.astSvgGenerator.generate(width, height);
        exportSvgFile(svgElement);
    };
}
