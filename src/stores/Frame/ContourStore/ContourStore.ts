import * as CARTACompute from "carta_computation";
import {action, computed, makeObservable, observable} from "mobx";

import {ContourWebGLService} from "services";
import {GL2} from "utilities";

export class ContourStore {
    @observable progress: Map<number, number>;
    @observable numGeneratedVertices: Map<number, number[]>;
    @observable vertexCount: number = 0;
    @observable chunkCount: number = 0;

    private indexOffsets: Map<number, Int32Array[]>;
    private vertexData: Map<number, Float32Array[]>;
    private vertexBuffers: Map<number, WebGLBuffer[]>;

    private gl: WebGL2RenderingContext;
    // Number of vertex data "float" values (normals are actually int16, so both coordinates count as one 32-bit value)
    // Each vertex is repeated twice
    private static VertexDataElements = 8;

    get hasValidData() {
        if (!this.vertexData) {
            return false;
        }

        // return this.vertexData[0].length > 0;
        return true;
    }

    isComplete(channel: number) {
        return this.progress.get(channel) >= 1.0;
        // return Object.values(this.progress).every(progress => progress >= 1.0);
    }

    constructor() {
        makeObservable(this);
        this.gl = ContourWebGLService.Instance.gl;
        this.progress = new Map<number, number>();
        this.numGeneratedVertices = new Map<number, number[]>();
        this.indexOffsets = new Map<number, Int32Array[]>();
        this.vertexData = new Map<number, Float32Array[]>();
        this.vertexBuffers = new Map<number, WebGLBuffer[]>();
    }

    @action setContourData = (indexOffsets: Int32Array, vertexData: Float32Array, progress: number, channel: number) => {
        // Clear existing data to remove data buffers
        this.clearChannelData(channel);
        this.addContourData(indexOffsets, vertexData, progress, channel);
    };

    @action addContourData = (indexOffsets: Int32Array, sourceVertices: Float32Array, progress: number, channel: number) => {
        const numVertices = sourceVertices.length / 2;

        if (!numVertices) {
            return;
        }

        if (!this.vertexData.has(channel)) {
            this.vertexData.set(channel, []);
        }
        if (!this.indexOffsets.has(channel)) {
            this.indexOffsets.set(channel, []);
        }
        if (!this.numGeneratedVertices.has(channel)) {
            this.numGeneratedVertices.set(channel, []);
        }

        const vertexData = CARTACompute.GenerateVertexData(sourceVertices, indexOffsets);
        this.vertexData.get(channel).push(vertexData);
        this.indexOffsets.get(channel).push(indexOffsets);
        this.progress.set(channel, progress);
        this.numGeneratedVertices.get(channel).push(vertexData.length / (ContourStore.VertexDataElements / 2));

        
        const index = this.vertexData.get(channel).length - 1;
        this.generateBuffers(index, channel);

        this.vertexCount += numVertices;
        this.chunkCount++;
    };

    private generateBuffers(index: number, channel: number) {
        if (!this.vertexBuffers.has(channel)) {
            this.vertexBuffers.set(channel, []);
        }

        if (!this.gl || this.vertexBuffers.get(channel).length !== index) {
            console.log(`WebGL buffer index is incorrect!`);
            return;
        }

        // TODO: handle buffer cleanup when no longer needed
        this.vertexBuffers.get(channel).push(this.gl.createBuffer());
        this.gl.bindBuffer(GL2.ARRAY_BUFFER, this.vertexBuffers.get(channel)[index]);
        this.gl.bufferData(GL2.ARRAY_BUFFER, this.vertexData.get(channel)[index], GL2.STATIC_DRAW);

        // Clear CPU memory after copying to GPU
        this.vertexData.get(channel)[index] = null;
    }

    @action clearData = () => {
        this.indexOffsets.forEach((indexes, channel) => indexes = []);
        this.vertexData.forEach((vertex, channel) => vertex = []);
        this.numGeneratedVertices.forEach((num, channel) => num = []);
        this.vertexCount = 0;
        this.chunkCount = 0;

        if (this.gl && this.vertexBuffers) {
            const numBuffers = this.vertexBuffers.size;
            for (let i = 0; i < numBuffers; i++) {
                this.gl.deleteBuffer(this.vertexBuffers[i]);
            }
            this.vertexBuffers = new Map<number, WebGLBuffer[]>();
        }
    };

    @action clearChannelData = (channel: number) => {
        this.indexOffsets.set(channel, []);
        this.vertexData.set(channel, []);
        this.numGeneratedVertices.set(channel, []);
        this.vertexCount = 0;
        this.chunkCount = 0;

        if (this.gl && this.vertexBuffers.has(channel)) {
            const numBuffers = this.vertexBuffers.get(channel).length;
            for (let i = 0; i < numBuffers; i++) {
                this.gl.deleteBuffer(this.vertexBuffers.get(channel)[i]);
            }
            this.vertexBuffers.set(channel, []);
        }
    };

    bindBuffer(index: number, channel: number) {
        if (channel && (!this.vertexBuffers.has(channel) || index >= this.vertexBuffers.get(channel).length)) {
            console.log(`WebGL buffer missing`);
        } else {
            this.gl.bindBuffer(GL2.ARRAY_BUFFER, this.vertexBuffers.get(channel)[index]);
        }
    }
}
