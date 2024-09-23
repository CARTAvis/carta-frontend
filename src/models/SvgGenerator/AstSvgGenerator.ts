import * as AST from "ast_wrapper";
import {Context} from "svgcanvas";

export class AstSvgGenerator {
    plotFunction: (() => void) | null = null;

    generate = (width: number, height: number): (HTMLElement & SVGElement) | null => {
        if (!this.plotFunction) {
            console.error("AST plot function unset.");
            return null;
        }

        const mockCanvasContext = new Context({width, height});
        AST.setCanvas(mockCanvasContext, height);
        this.plotFunction();
        return mockCanvasContext.getSvg();
    };
}
