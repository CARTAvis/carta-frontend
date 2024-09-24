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
            case "Rect": {
                const colorStops = shape.fillLinearGradientColorStops();
                if (colorStops?.length) {
                    const pos = shape.position();
                    const startPoint = shape.fillLinearGradientStartPoint();
                    const endPoint = shape.fillLinearGradientEndPoint();

                    if (!this.layerRef) {
                        break;
                    }
                    const mockCanvasContext = this.layerRef.canvas.context._context;
                    const pixelRatio = this.layerRef.canvas.pixelRatio;
                    const gradient = mockCanvasContext.createLinearGradient(
                        pos.x * pixelRatio + startPoint.x * pixelRatio,
                        pos.y * pixelRatio + startPoint.y * pixelRatio,
                        pos.x * pixelRatio + endPoint.x * pixelRatio,
                        pos.y * pixelRatio + endPoint.y * pixelRatio
                    );
                    // must add color stops from offset 0 to offset 1
                    for (let i = colorStops.length - 2; i > -1; i -= 2) {
                        gradient.addColorStop(colorStops[i] as number, colorStops[i + 1] as string);
                    }
                    mockCanvasContext.fillStyle = gradient;

                    shape.fillEnabled(false);
                    shape.draw();
                    shape.fillEnabled(true);
                } else {
                    shape.strokeScaleEnabled(true);
                    const oldStokeWidth = shape.strokeWidth();
                    const scale = shape.getStage()?.scale()?.x ?? 1;
                    shape.strokeWidth(oldStokeWidth / scale);
                    shape.draw();
                    shape.strokeScaleEnabled(false);
                    shape.strokeWidth(oldStokeWidth);
                }
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
