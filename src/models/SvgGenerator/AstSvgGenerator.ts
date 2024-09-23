import {Context} from "svgcanvas";

export class AstSvgGenerator {
    plotFunction: ((canvasContext: CanvasRenderingContext2D, canvasHeight: number) => void) | null = null;

    generate = (width: number, height: number): (HTMLElement & SVGElement) | null => {
        if (!this.plotFunction) {
            console.error("AST plot function unset.");
            return null;
        }
        const mockCanvasContext = new Context({width, height});
        this.plotFunction(mockCanvasContext as CanvasRenderingContext2D, height);
        return mockCanvasContext.getSvg();
    };
}
