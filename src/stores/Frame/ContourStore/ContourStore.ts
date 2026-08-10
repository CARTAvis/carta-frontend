import * as CARTACompute from "carta_computation";
import {action, makeObservable, observable} from "mobx";

import {ContourWebGLService} from "services";
import {GL2} from "utilities";

export class ContourStore {
    @observable progress: {[channel: number]: number} = {};
    @observable numGeneratedVertices: {[channel: number]: number[]} = {};
    @observable vertexCount: {[channel: number]: number} = {};
    @observable chunkCount: {[channel: number]: number} = {};

    private indexOffsets: {[channel: number]: Int32Array[]} = {};
    private vertexData: {[channel: number]: (Float32Array | null)[]} = {};
    private vertexBuffers: {[channel: number]: WebGLBuffer[]} = {};

    private gl: WebGL2RenderingContext | null;
    // Number of vertex data "float" values (normals are actually int16, so both coordinates count as one 32-bit value)
    // Each vertex is repeated twice
    private static vertexDataElements = 8;

    constructor() {
        makeObservable(this);
        this.gl = ContourWebGLService.Instance.gl;
    }

    isComplete(channel: number) {
        return (this.progress[channel] ?? 0) >= 1.0;
    }

    @action setContourData = (channel: number, indexOffsets: Int32Array, vertexData: Float32Array, progress: number) => {
        this.clearData(channel);
        this.addContourData(channel, indexOffsets, vertexData, progress);
    };

    @action setProgress = (channel: number, progress: number) => {
        this.progress[channel] = progress;
    };

    @action addContourData = (channel: number, indexOffsets: Int32Array, sourceVertices: Float32Array, progress: number) => {
        const numVertices = sourceVertices.length / 2;
        this.progress[channel] = progress;

        if (!numVertices) {
            return;
        }

        this.vertexData[channel] ??= [];
        this.indexOffsets[channel] ??= [];
        this.numGeneratedVertices[channel] ??= [];

        const vertexData = CARTACompute.GenerateVertexData(sourceVertices, indexOffsets);
        this.vertexData[channel].push(vertexData);
        this.indexOffsets[channel].push(indexOffsets);
        this.numGeneratedVertices[channel].push(vertexData.length / (ContourStore.vertexDataElements / 2));

        const index = this.vertexData[channel].length - 1;
        this.generateBuffers(channel, index);

        this.vertexCount[channel] = (this.vertexCount[channel] ?? 0) + numVertices;
        this.chunkCount[channel] = (this.chunkCount[channel] ?? 0) + 1;
    };

    private generateBuffers(channel: number, index: number) {
        this.vertexBuffers[channel] ??= [];

        if (!this.gl || this.vertexBuffers[channel].length !== index) {
            console.log(`WebGL buffer index is incorrect!`);
            return;
        }

        this.vertexBuffers[channel].push(this.gl.createBuffer()!);
        this.gl.bindBuffer(GL2.ARRAY_BUFFER, this.vertexBuffers[channel][index]);
        this.gl.bufferData(GL2.ARRAY_BUFFER, this.vertexData[channel][index], GL2.STATIC_DRAW);

        // Clear CPU memory after copying to GPU
        this.vertexData[channel][index] = null;
    }

    @action clearData = (channel?: number) => {
        const channels = channel === undefined ? Object.keys(this.vertexBuffers).map(Number) : [channel];
        if (this.gl) {
            channels.forEach(ch => this.vertexBuffers[ch]?.forEach(buffer => this.gl?.deleteBuffer(buffer)));
        }

        if (channel === undefined) {
            Object.keys(this.progress).forEach(ch => delete this.progress[Number(ch)]);
            Object.keys(this.numGeneratedVertices).forEach(ch => delete this.numGeneratedVertices[Number(ch)]);
            Object.keys(this.vertexCount).forEach(ch => delete this.vertexCount[Number(ch)]);
            Object.keys(this.chunkCount).forEach(ch => delete this.chunkCount[Number(ch)]);
            this.indexOffsets = {};
            this.vertexData = {};
            this.vertexBuffers = {};
            return;
        }

        delete this.indexOffsets[channel];
        delete this.vertexData[channel];
        delete this.vertexBuffers[channel];
        delete this.progress[channel];
        delete this.numGeneratedVertices[channel];
        delete this.vertexCount[channel];
        delete this.chunkCount[channel];
    };

    @action cleanupChannelsOutsideRange = (channels: number[]) => {
        Object.keys(this.progress)
            .map(Number)
            .filter(channel => !channels.includes(channel))
            .forEach(this.clearData);
    };

    bindBuffer(channel: number, index: number) {
        const buffer = this.vertexBuffers[channel]?.[index];
        if (!buffer) {
            console.log(`WebGL buffer missing`);
        } else if (this.gl) {
            this.gl.bindBuffer(GL2.ARRAY_BUFFER, buffer);
        }
    }
}
