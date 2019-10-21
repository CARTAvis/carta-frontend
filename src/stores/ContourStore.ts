import {action, computed, observable} from "mobx";
import * as CARTACompute from "carta_computation";
import {Point2D} from "models";
import {add2D, dot2D, length2D, normalize2D, perpVector2D, scale2D, subtract2D} from "utilities";

export class ContourStore {
    @observable indices: Int32Array[];
    @observable indexOffsets: Int32Array[];
    @observable vertexData: Float32Array[];
    @observable progress: number;

    vertexBuffers: WebGLBuffer[];
    indexBuffers: WebGLBuffer[];

    private gl: WebGLRenderingContext;
    // Number of vertex data "float" values (normals are actually int16, so both coordinates count as one 32-bit value)
    // Each vertex is repeated twice
    private static VertexDataElements = 8;

    @computed get hasValidData() {
        if (!this.indices || !this.vertexData) {
            return false;
        }

        return this.indices.length > 0 && this.vertexData.length > 0;
    }

    @computed get chunkCount() {
        if (!this.vertexData) {
            return 0;
        }
        return this.vertexData.length;
    }

    @computed get vertexCount() {
        if (!this.vertexData) {
            return 0;
        }
        let count = 0;
        for (let i = 0; i < this.vertexData.length; i++) {
            // Each vertex is repeated twice, and each vertex has two coordinates
            count += this.vertexData[i].length / ContourStore.VertexDataElements;
        }
        return count;
    }

    @computed get isComplete() {
        return this.progress >= 1.0;
    }

    @action setContourData = (indexOffsets: Int32Array, vertexData: Float32Array) => {
        // Clear existing data to remove data buffers
        this.clearData();
        this.addContourData(indexOffsets, vertexData, 1.0);
    };

    @action addContourData = (indexOffsets: Int32Array, sourceVertices: Float32Array, progress: number) => {
        const numVertices = sourceVertices.length / 2;

        if (!this.vertexData) {
            this.vertexData = [];
        }
        if (!this.indexOffsets) {
            this.indexOffsets = [];
        }
        if (!this.indices) {
            this.indices = [];
        }

        this.vertexData.push(CARTACompute.GenerateVertexData(sourceVertices, indexOffsets));
        this.indexOffsets.push(indexOffsets);
        this.indices.push(ContourStore.GenerateLineIndices(indexOffsets, numVertices));
        this.progress = progress;
    };

    private static GenerateLineIndices(indexOffsets: Int32Array, numVertices: number) {
        const numPolyLines = indexOffsets.length;
        const indices = new Int32Array((numVertices - numPolyLines) * 6);

        let destOffset = 0;

        for (let i = 0; i < numPolyLines; i++) {
            const startIndex = indexOffsets[i] / 2;
            const endIndex = i < numPolyLines - 1 ? indexOffsets[i + 1] / 2 : numVertices;

            for (let j = startIndex; j < endIndex - 1; j++) {
                const offset = j * 2;
                indices[destOffset] = offset;
                indices[destOffset + 1] = offset + 1;
                indices[destOffset + 2] = offset + 3;
                indices[destOffset + 3] = offset + 3;
                indices[destOffset + 4] = offset + 2;
                indices[destOffset + 5] = offset;
                destOffset += 6;
            }
        }
        return indices;
    }

    @action generateBuffers(gl: WebGLRenderingContext, index: number) {
        if (!this.vertexBuffers) {
            this.vertexBuffers = [];
        }
        if (!this.indexBuffers) {
            this.indexBuffers = [];
        }

        // skip this if the buffers are already generated
        if (gl === this.gl && this.vertexBuffers[index] && this.indexBuffers[index]) {
            return;
        }

        if (this.vertexBuffers.length !== index) {
            console.log(`WebGL buffer index is incorrect!`);
        }

        // TODO: handle buffer cleanup when no longer needed
        this.gl = gl;
        this.indexBuffers.push(this.gl.createBuffer());
        this.vertexBuffers.push(this.gl.createBuffer());
        this.gl.bindBuffer(WebGLRenderingContext.ELEMENT_ARRAY_BUFFER, this.indexBuffers[index]);
        this.gl.bufferData(WebGLRenderingContext.ELEMENT_ARRAY_BUFFER, this.indices[index], WebGLRenderingContext.STATIC_DRAW);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexBuffers[index]);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, this.vertexData[index], WebGLRenderingContext.STATIC_DRAW);
    }

    @action clearData = () => {
        this.indices = [];
        this.indexOffsets = [];
        this.vertexData = [];

        if (this.gl && this.vertexBuffers) {
            const numBuffers = this.vertexBuffers.length;
            for (let i = 0; i < numBuffers; i++) {
                this.gl.deleteBuffer(this.indexBuffers[i]);
                this.gl.deleteBuffer(this.vertexBuffers[i]);
            }
            this.indexBuffers = [];
            this.vertexBuffers = [];
        }
    };
}