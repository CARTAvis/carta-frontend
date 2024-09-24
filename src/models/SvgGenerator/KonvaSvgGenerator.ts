import Konva from "konva";
import {Context} from "svgcanvas";

export class KonvaSvgGenerator {
    layerRef: Konva.Layer | null = null;

    generate = (width: number, height: number, leftPadding: number, topPadding: number): (HTMLElement & SVGElement) | null => {
        if (!this.layerRef) {
            console.error("Konva layer unset.");
            return null;
        }

        const mockCanvasContext = new Context({width, height});
        mockCanvasContext.imageSmoothingEnabled = false;
        mockCanvasContext.translate(leftPadding, topPadding);
        mockCanvasContext.scale(this.layerRef.canvas.pixelRatio);

        mockCanvasContext.beginPath();
        mockCanvasContext.rect(0, 0, this.layerRef.size().width, this.layerRef.size().height);
        mockCanvasContext.clip();

        const oldContext = this.layerRef.canvas.context._context;
        this.layerRef.canvas.context._context = mockCanvasContext;
        this.plotKonvaGroup(this.layerRef);
        this.layerRef.canvas.context._context = oldContext;

        return mockCanvasContext.getSvg();
    };

    private plotKonvaGroup = (group: Konva.Group) => {
        group.children?.forEach(node => {
            if (node.getType() === "Shape") {
                this.plotKonvaShape(node as Konva.Shape);
            } else {
                this.plotKonvaGroup(node as Konva.Group);
            }
        });
    };

    private plotKonvaShape = (shape: Konva.Shape) => {
        switch (shape.getClassName()) {
            case "Arrow": {
                shape.strokeScaleEnabled(true);
                const oldStokeWidth = shape.strokeWidth();
                const scale = shape.getStage()?.scale()?.x ?? 1;
                shape.strokeWidth(oldStokeWidth / scale);
                shape.draw();
                shape.strokeScaleEnabled(false);
                shape.strokeWidth(oldStokeWidth);
                console.warn("TODO: support triangle part of the arrow");
                break;
            }
            case "Ellipse": {
                console.warn("TODO: support ellipse");
                break;
            }
            default: {
                shape.strokeScaleEnabled(true);
                const oldStokeWidth = shape.strokeWidth();
                const scale = shape.getStage()?.scale()?.x ?? 1;
                shape.strokeWidth(oldStokeWidth / scale);
                shape.draw();
                shape.strokeScaleEnabled(false);
                shape.strokeWidth(oldStokeWidth);
                break;
            }
        }
    };
}
