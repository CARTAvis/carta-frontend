import {Context} from "svgcanvas";

export class AstSvgGenerator {
    generate = (width, height): HTMLElement & SVGElement => {
        const mockCanvas = new Context({width, height});
        return mockCanvas.getSvg();
    };
}
