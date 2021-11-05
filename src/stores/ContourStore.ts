import {action, computed, observable, makeObservable} from "mobx";
import * as CARTACompute from "carta_computation";
import {ContourWebGLService} from "../services";
import {GL2} from "utilities";

export class ContourStore {
    @observable progress: number;
    @observable isLongTask: boolean;
    @observable numGeneratedVertices: number[];
    @observable vertexCount: number = 0;
    @observable chunkCount: number = 0;

    private indexOffsets: Int32Array[];
    private vertexData: Float32Array[];
    private vertexBuffers: WebGLBuffer[];

    private gl: WebGL2RenderingContext;
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
        this.gl = ContourWebGLService.Instance.gl;
        this.progress = 0;
    }

    @action resetProgress = () => {
        this.progress = 0;
    };

    @action setContourData = (indexOffsets: Int32Array, vertexData: Float32Array, progress: number, isLongTask: boolean) => {
        // Clear existing data to remove data buffers
        this.clearData();
        this.addContourData(indexOffsets, vertexData, progress, isLongTask);
    };

    @action addContourData = (indexOffsets: Int32Array, sourceVertices: Float32Array, progress: number, isLongTask: boolean) => {
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
        if (!this.numGeneratedVertices) {
            this.numGeneratedVertices = [];
        }

        const vertexData = CARTACompute.GenerateVertexData(sourceVertices, indexOffsets);
        this.vertexData.push(vertexData);
        this.indexOffsets.push(indexOffsets);
        this.progress = progress;
        this.isLongTask = isLongTask;
        this.numGeneratedVertices.push(vertexData.length / (ContourStore.VertexDataElements / 2));

        const index = this.vertexData.length - 1;
        this.generateBuffers(index);

        this.vertexCount += numVertices;
        this.chunkCount++;
    };

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
        this.gl.bindBuffer(GL2.ARRAY_BUFFER, this.vertexBuffers[index]);
        this.gl.bufferData(GL2.ARRAY_BUFFER, this.vertexData[index], GL2.STATIC_DRAW);

        // Clear CPU memory after copying to GPU
        this.vertexData[index] = null;
    }

    @action clearData = () => {
        this.indexOffsets = [];
        this.vertexData = [];
        this.numGeneratedVertices = [];
        this.vertexCount = 0;
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
            this.gl.bindBuffer(GL2.ARRAY_BUFFER, this.vertexBuffers[index]);
        }
    }
}
