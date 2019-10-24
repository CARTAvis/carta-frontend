import {action, computed, observable} from "mobx";
import * as CARTACompute from "carta_computation";
import TypedArray = NodeJS.TypedArray;

export class ContourStore {
    @observable progress: number;
    @observable numIndices: number[];
    @observable vertexCount: number = 0;
    @observable chunkCount: number = 0;

    private indices: (Uint16Array | Uint32Array)[];
    private indexOffsets: Int32Array[];
    private vertexData: Float32Array[];
    private vertexBuffers: WebGLBuffer[];
    private indexBuffers: WebGLBuffer[];

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

    @computed get isComplete() {
        return this.progress >= 1.0;
    }

    constructor(gl: WebGLRenderingContext) {
        this.gl = gl;
    }

    @action setContourData = (indexOffsets: Int32Array, vertexData: Float32Array, progress: number) => {
        // Clear existing data to remove data buffers
        this.clearData();
        this.addContourData(indexOffsets, vertexData, progress);
    };

    @action addContourData = (indexOffsets: Int32Array, sourceVertices: Float32Array, progress: number) => {
        const numVertices = sourceVertices.length / 2;

        if (!numVertices) {
            return;
        }

        if (!this.vertexData) {
            this.vertexData = [];
        }
        if (!this.indexOffsets) {
            this.indexOffsets = [];
        }
        if (!this.indices) {
            this.indices = [];
        }
        if (!this.numIndices) {
            this.numIndices = [];
        }

        const vertexData = CARTACompute.GenerateVertexData(sourceVertices, indexOffsets);
        const indexData = ContourStore.GenerateLineIndices(indexOffsets, numVertices);
        this.vertexData.push(vertexData);
        this.indexOffsets.push(indexOffsets);
        this.indices.push(indexData);
        this.progress = progress;

        // Store the number of indices as negative, to indicate that the index buffer
        // for this chunk is an UNSIGNED_SHORT type
        if (indexData.BYTES_PER_ELEMENT === 2) {
            this.numIndices.push(-indexData.length);
        } else {
            this.numIndices.push(indexData.length);
        }

        const index = this.vertexData.length - 1;
        this.generateBuffers(index);

        this.vertexCount += numVertices;
        this.chunkCount++;
    };

    private static GenerateLineIndices(indexOffsets: Int32Array, numVertices: number): Uint16Array | Uint32Array {
        const numPolyLines = indexOffsets.length;
        let indices: TypedArray;
        if (numVertices < 32767) {
            indices = new Uint16Array((numVertices - numPolyLines) * 6);
        } else {
            indices = new Uint32Array((numVertices - numPolyLines) * 6);
        }

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

    @action generateBuffers(index: number) {
        if (!this.vertexBuffers) {
            this.vertexBuffers = [];
        }
        if (!this.indexBuffers) {
            this.indexBuffers = [];
        }

        // just bind if the buffers are already generated
        if (this.vertexBuffers[index] && this.indexBuffers[index]) {
            this.gl.bindBuffer(WebGLRenderingContext.ELEMENT_ARRAY_BUFFER, this.indexBuffers[index]);
            this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexBuffers[index]);
            return;
        }

        if (this.vertexBuffers.length !== index) {
            console.log(`WebGL buffer index is incorrect!`);
        }

        // TODO: handle buffer cleanup when no longer needed
        this.indexBuffers.push(this.gl.createBuffer());
        this.vertexBuffers.push(this.gl.createBuffer());
        this.gl.bindBuffer(WebGLRenderingContext.ELEMENT_ARRAY_BUFFER, this.indexBuffers[index]);
        this.gl.bufferData(WebGLRenderingContext.ELEMENT_ARRAY_BUFFER, this.indices[index], WebGLRenderingContext.STATIC_DRAW);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexBuffers[index]);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, this.vertexData[index], WebGLRenderingContext.STATIC_DRAW);

        // Clear CPU memory after copying to GPU
        this.vertexData[index] = null;
        this.indices[index] = null;
    }

    @action clearData = () => {
        this.indices = [];
        this.indexOffsets = [];
        this.vertexData = [];
        this.numIndices = [];
        this.vertexCount = 0;
        this.chunkCount = 0;

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