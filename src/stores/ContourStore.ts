import {action, computed, observable, makeObservable} from "mobx";
import {Queue} from "mnemonist";
import * as CARTACompute from "carta_computation";
import {ContourWebGLService} from "../services";

export class ContourStore {
    @observable progress: number;
    @observable numGeneratedVertices: number[];
    @observable chunkCount: number = 0;

    private vertexData: Float32Array[];
    private vertexBuffers: WebGLBuffer[];
    private dataQueue: Queue<Float32Array>;

    private gl: WebGLRenderingContext;
    // Number of vertex data "float" values (normals are actually int16, so both coordinates count as one 32-bit value)
    // Each vertex is repeated twice
    private static VertexDataElements = 8;

    @computed get hasValidData() {
        if (!this.vertexData) {
            return false;
        }

        return this.vertexData.length > 0;
    }

    @computed get isComplete() {
        return this.progress >= 1.0;
    }

    constructor() {
        makeObservable(this);
        this.dataQueue = new Queue<Float32Array>();
        this.gl = ContourWebGLService.Instance.gl;
    }

    @action enqueueContourData = (indexOffsets: Int32Array, sourceVertices: Float32Array, progress: number) => {
        if (!sourceVertices.length) {
            return;
        }
        const vertexData = CARTACompute.GenerateVertexData(sourceVertices, indexOffsets).slice();
        this.dataQueue.enqueue(vertexData);
        this.progress = progress;

        if (progress >= 1.0) {
            // Flush the queue
            this.clearData();
            while (this.dataQueue.size) {
                this.addGeneratedContourData(this.dataQueue.dequeue(), 1.0)
            }
        }
    }

    @action clearQueue = () => {
        this.progress = 1.0;
        this.dataQueue.clear();
    }

    // @action setContourData = (indexOffsets: Int32Array, vertexData: Float32Array, progress: number) => {
    //     // Clear existing data to remove data buffers
    //     this.clearData();
    //     this.addContourData(indexOffsets, vertexData, progress);
    // };

    @action addGeneratedContourData = (vertexData: Float32Array, progress: number) => {
        if (!vertexData.length) {
            return;
        }

        if (!this.vertexData) {
            this.vertexData = [];
        }
        if (!this.numGeneratedVertices) {
            this.numGeneratedVertices = [];
        }

        this.vertexData.push(vertexData);
        this.progress = progress;
        this.numGeneratedVertices.push(vertexData.length / (ContourStore.VertexDataElements / 2));

        const index = this.vertexData.length - 1;
        this.generateBuffers(index);
        this.chunkCount++;
    };

    // @action addContourData = (indexOffsets: Int32Array, sourceVertices: Float32Array, progress: number) => {
    //     const numVertices = sourceVertices.length / 2;
    //
    //     if (!numVertices) {
    //         return;
    //     }
    //
    //     if (!this.vertexData) {
    //         this.vertexData = [];
    //     }
    //
    //     if (!this.numGeneratedVertices) {
    //         this.numGeneratedVertices = [];
    //     }
    //
    //     const vertexData = CARTACompute.GenerateVertexData(sourceVertices, indexOffsets);
    //     this.vertexData.push(vertexData);
    //     //this.indexOffsets.push(indexOffsets);
    //     this.progress = progress;
    //     this.numGeneratedVertices.push(vertexData.length / (ContourStore.VertexDataElements / 2));
    //
    //     const index = this.vertexData.length - 1;
    //     this.generateBuffers(index);
    //
    //     this.chunkCount++;
    // };

    private generateBuffers(index: number) {
        if (!this.vertexBuffers) {
            this.vertexBuffers = [];
        }

        if (!this.gl || this.vertexBuffers.length !== index) {
            console.log(`WebGL buffer index is incorrect!`);
            return;
        }

        // TODO: handle buffer cleanup when no longer needed
        this.vertexBuffers.push(this.gl.createBuffer());
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexBuffers[index]);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, this.vertexData[index], WebGLRenderingContext.STATIC_DRAW);

        // Clear CPU memory after copying to GPU
        this.vertexData[index] = null;
    }

    @action clearData = () => {
        this.vertexData = [];
        this.numGeneratedVertices = [];
        this.chunkCount = 0;

        if (this.gl && this.vertexBuffers) {
            const numBuffers = this.vertexBuffers.length;
            for (let i = 0; i < numBuffers; i++) {
                this.gl.deleteBuffer(this.vertexBuffers[i]);
            }
            this.vertexBuffers = [];
        }
    };

    bindBuffer(index: number) {
        if (!this.vertexBuffers || index >= this.vertexBuffers.length) {
            console.log(`WebGL buffer missing`);
        } else {
            this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexBuffers[index]);
        }
    }
}
