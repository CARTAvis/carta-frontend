import {action, computed, observable} from "mobx";
import {Point2D} from "models";
import {length2D, normal2D, subtract2D} from "utilities";
import {first} from "rxjs/operators";

export class ContourStore {
    @observable indices: Int32Array;
    @observable indexOffsets: Int32Array;
    @observable vertexData: Float32Array;
    @observable lengthData: Float32Array;
    @observable normalData: Float32Array;

    vertexDataBuffer: WebGLBuffer;
    vertexNormalBuffer: WebGLBuffer;
    vertexLengthBuffer: WebGLBuffer;
    indexBuffer: WebGLBuffer;

    private gl: WebGLRenderingContext;

    @computed get hasValidData() {
        if (!this.indices || !this.vertexData) {
            return false;
        }

        return this.indices.length > 0 && this.vertexData.length > 0;
    }

    @action setContourData = (indexOffsets: Int32Array, vertexData: Float32Array) => {
        // Clear existing data to remove data buffers
        this.clearData();

        const numVertices = vertexData.length / 2;

        this.vertexData = ContourStore.DuplicateVertexData(vertexData);
        this.indexOffsets = indexOffsets;
        this.normalData = ContourStore.GenerateLineNormals(vertexData, indexOffsets);
        this.indices = ContourStore.GenerateLineIndices(indexOffsets, numVertices);
        this.lengthData = ContourStore.GenerateLengthData(vertexData);
    };

    private static DuplicateVertexData(vertexData: Float32Array) {
        const numVertices = vertexData.length / 2;
        const duplicateData = new Float32Array(numVertices * 4);

        for (let i = 0; i < numVertices; i++) {
            const x = vertexData[i * 2];
            const y = vertexData[i * 2 + 1];
            duplicateData[i * 4] = x;
            duplicateData[i * 4 + 1] = y;
            duplicateData[i * 4 + 2] = x;
            duplicateData[i * 4 + 3] = y;
        }

        return duplicateData;
    }

    private static GenerateLineNormals(vertexData: Float32Array, indexOffsets: Int32Array) {
        const numPolyLines = indexOffsets.length;
        const numVertices = vertexData.length / 2;
        const numLineSegments = 2 * (numVertices - numPolyLines);
        const normalData = new Float32Array(numVertices * 4);
        let lineCounter = 1;
        let endVertex = (lineCounter === numPolyLines) ? numVertices - 1 : indexOffsets[lineCounter] / 2 - 1;
        // TODO: combine normals for inner line segments properly
        let previousNormal = {x: 0, y: 0};
        let previousPoint = {x: 0, y: 0};
        let firstVertex = true;
        for (let i = 0; i < numVertices - 1; i++) {
            let currentNormal: Point2D;
            if (i >= endVertex) {
                // calculate normals based on only the end line. in future, we should check if the polyline is a loop or not
                currentNormal = previousNormal;
                firstVertex = true;

                endVertex = (lineCounter === numPolyLines) ? numVertices - 1 : indexOffsets[lineCounter] / 2 - 1;
                lineCounter++;

            } else {
                const currentPoint = {x: vertexData[i * 2], y: vertexData[i * 2 + 1]};
                const nextPoint = {x: vertexData[i * 2 + 2], y: vertexData[i * 2 + 3]};
                currentNormal = normal2D(currentPoint, nextPoint);
                console.log(currentNormal);
                // calculate pseudo-normals based on current line
                if (firstVertex) {

                } else {

                }
                firstVertex = false;
            }
            const mirrorNormal = {x: -currentNormal.x, y: -currentNormal.y};
            normalData[i * 4] = currentNormal.x;
            normalData[i * 4 + 1] = currentNormal.y;
            normalData[i * 4 + 2] = mirrorNormal.x;
            normalData[i * 4 + 3] = mirrorNormal.y;
            previousNormal = currentNormal;
        }

        return normalData;
    }

    private static GenerateLineIndices(indexOffsets: Int32Array, numVertices: number) {
        const numPolyLines = indexOffsets.length;
        const numLineSegments = numVertices - numPolyLines;
        const indices = new Int32Array(6 * (numLineSegments + 1));
        let indexCounter = 0;
        let lineCounter = 1;
        let maxIndex = 0;
        let endVertex = (lineCounter === numPolyLines) ? numVertices - 1 : indexOffsets[lineCounter] / 2 - 1;
        for (let i = 0; i < numVertices - 1; i++) {
            // end current polyline if we've reached the end vertex
            if (i >= endVertex) {
                endVertex = (lineCounter === numPolyLines) ? numVertices - 1 : indexOffsets[lineCounter] / 2 - 1;
                lineCounter++;
            } else {
                const i0 = i * 2;
                indices[indexCounter] = i0;
                indices[indexCounter + 1] = i0 + 2;
                indices[indexCounter + 2] = i0 + 1;
                indices[indexCounter + 3] = i0;
                indices[indexCounter + 4] = i0 + 2;
                indices[indexCounter + 5] = i0 + 3;
                indexCounter += 6;
                maxIndex = i + 1;
            }
        }
        return indices;
    }

    private static GenerateLengthData(vertexData: Float32Array) {
        const N = vertexData.length;
        const lengths = new Float32Array(N);
        let cumulativeLength = 0;
        let lastPoint: Point2D = null;

        for (let i = 0; i < N; i += 2) {
            const currentPoint = {x: vertexData[i], y: vertexData[i + 1]};
            let currentLength = 0;
            if (lastPoint) {
                const delta = subtract2D(currentPoint, lastPoint);
                currentLength = length2D(delta);
            }

            lastPoint = currentPoint;
            cumulativeLength += currentLength;
            lengths[i] = cumulativeLength;
            lengths[i + 1] = cumulativeLength;
        }
        return lengths;
    }

    @action generateBuffers(gl: WebGLRenderingContext) {
        // skip this if the buffers are already generated
        if (gl === this.gl && this.vertexDataBuffer && this.vertexNormalBuffer && this.vertexLengthBuffer && this.indexBuffer) {
            return;
        }

        // TODO: handle buffer cleanup when no longer needed
        this.gl = gl;
        this.indexBuffer = this.gl.createBuffer();
        this.vertexDataBuffer = this.gl.createBuffer();
        this.vertexLengthBuffer = this.gl.createBuffer();
        this.vertexNormalBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(WebGLRenderingContext.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        this.gl.bufferData(WebGLRenderingContext.ELEMENT_ARRAY_BUFFER, this.indices, WebGLRenderingContext.STATIC_DRAW);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexDataBuffer);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, this.vertexData, WebGLRenderingContext.STATIC_DRAW);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexNormalBuffer);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, this.normalData, WebGLRenderingContext.STATIC_DRAW);
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
            this.gl.deleteBuffer(this.vertexNormalBuffer);
            this.gl.deleteBuffer(this.vertexLengthBuffer);
            this.indexBuffer = null;
            this.vertexDataBuffer = null;
            this.vertexLengthBuffer = null;
        }
    };
}