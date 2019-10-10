import {action, computed, observable} from "mobx";
import {Point2D} from "models";
import {length2D, subtract2D} from "utilities";

export class ContourStore {
    @observable indices: Int32Array;
    @observable indexOffsets: Int32Array;
    @observable vertexData: Float32Array;
    @observable lengthData: Float32Array;

    vertexDataBuffer: WebGLBuffer;
    vertexLengthBuffer: WebGLBuffer;
    indexBuffer: WebGLBuffer;

    private gl: WebGLRenderingContext;

    @computed get hasValidData() {
        if (!this.indices || !this.vertexData) {
            return false;
        }

        return this.indices.length > 0 && this.vertexData.length > 0;
    }

    @action setContourData = (indices: Int32Array, indexOffsets: Int32Array, vertexData: Float32Array) => {
        // Clear existing data to remove data buffers
        this.clearData();

        this.indices = indices;
        this.vertexData = vertexData;
        this.indexOffsets = indexOffsets;

        const N = vertexData.length;
        const lengths = new Float32Array(N / 2);
        let cumulativeLength = 0;
        let lastPoint: Point2D = null;

        for (let i = 0; i < N - 1; i += 2) {
            const currentPoint = {x: vertexData[i], y: vertexData[i + 1]};
            let currentLength = 0;
            if (lastPoint) {
                const delta = subtract2D(currentPoint, lastPoint);
                currentLength = length2D(delta);
            }

            lastPoint = currentPoint;
            cumulativeLength += currentLength;
            lengths[i / 2] = cumulativeLength;
        }

        this.lengthData = lengths;
    };

    @action generateBuffers(gl: WebGLRenderingContext) {
        // skip this if the buffers are already generated
        if (gl === this.gl && this.vertexDataBuffer && this.vertexLengthBuffer && this.indexBuffer) {
            return;
        }

        // TODO: handle buffer cleanup when no longer needed
        this.gl = gl;
        this.indexBuffer = this.gl.createBuffer();
        this.vertexDataBuffer = this.gl.createBuffer();
        this.vertexLengthBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(WebGLRenderingContext.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        this.gl.bufferData(WebGLRenderingContext.ELEMENT_ARRAY_BUFFER, this.indices, WebGLRenderingContext.STATIC_DRAW);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexDataBuffer);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, this.vertexData, WebGLRenderingContext.STATIC_DRAW);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexLengthBuffer);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, this.lengthData, WebGLRenderingContext.STATIC_DRAW);
    }

    @action clearData = () => {
        this.indices = null;
        this.indexOffsets = null;
        this.vertexData = null;

        if (this.gl) {
            this.gl.deleteBuffer(this.indexBuffer);
            this.gl.deleteBuffer(this.vertexDataBuffer);
            this.gl.deleteBuffer(this.vertexLengthBuffer);
            this.indexBuffer = null;
            this.vertexDataBuffer = null;
            this.vertexLengthBuffer = null;
        }
    };
}