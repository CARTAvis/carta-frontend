import * as AST from "ast_wrapper";
import {CatalogStore} from "stores";
import {FrameStore} from "stores/Frame";
import {ControlMap} from "models";

export class CatalogControlMap extends ControlMap {
    private boundaryUpdated: boolean;

    constructor(src: FrameStore, dst: FrameStore, astTransform: AST.FrameSet, width: number, height: number) {
        super(src, dst, astTransform, width, height, false);
        this.minPoint = {x: Number.MAX_VALUE, y: Number.MAX_VALUE};
        this.maxPoint = {x: -Number.MAX_VALUE, y: -Number.MAX_VALUE};
        this.boundaryUpdated = false;
    }

    updateCatalogBoundary = () => {
        const catalogStore = CatalogStore.Instance;
        const srcMinMax = catalogStore.getFrameMinMaxPoints(this.source.frameInfo.fileId);
        const dstMinMax = catalogStore.getFrameMinMaxPoints(this.destination.frameInfo.fileId);
        const minX = srcMinMax.minX < dstMinMax.minX ? srcMinMax.minX : dstMinMax.minX;
        const minY = srcMinMax.minY < dstMinMax.minY ? srcMinMax.minY : dstMinMax.minY;
        const maxX = srcMinMax.maxX > dstMinMax.maxX ? srcMinMax.maxX : dstMinMax.maxX;
        const maxY = srcMinMax.maxY > dstMinMax.maxY ? srcMinMax.maxY : dstMinMax.maxY;
        if (this.minPoint.x > minX || this.minPoint.y > minY || this.maxPoint.x < maxX || this.maxPoint.y < maxY) {
            this.setMinMaxPoint(minX, minY, maxX, maxY);
            this.boundaryUpdated = true;
            this.setGrid();
        }
    };

    getTextureX = (gl: WebGL2RenderingContext) => {
        if (gl !== this.gl || !this.texture || this.boundaryUpdated) {
            this.boundaryUpdated = false;
            // Context has changed, texture needs to be regenerated
            this.createTexture(gl);
        }
        return this.texture;
    };
}
