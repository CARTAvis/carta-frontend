import {action, computed, observable} from "mobx";
import {Point2D} from "models";
import {add2D, dot2D, length2D, normal2D, normalize2D, perpVector2D, scale2D, subtract2D} from "utilities";
import {first} from "rxjs/operators";
import {start} from "repl";

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

        for (let i = 0; i < numPolyLines; i++) {
            const startIndex = indexOffsets[i];
            const endIndex = i < numPolyLines - 1 ? indexOffsets[i + 1] : numVertices;
            ContourStore.FillSinglePolylineNormals(vertexData, startIndex, endIndex, normalData);
        }
        return normalData;
    }

    private static FillSinglePolylineNormals(vertexData: Float32Array, startIndex: number, endIndex: number, normalData: Float32Array) {
        const numVertices = endIndex - startIndex;

        if (numVertices < 2) {
            return;
        }

        // First vertex
        let vertexOffset = startIndex * 2;
        let currentPoint = {x: vertexData[vertexOffset], y: vertexData[vertexOffset + 1]};
        let nextPoint = {x: vertexData[vertexOffset + 2], y: vertexData[vertexOffset + 3]};

        const firstDir = normalize2D(subtract2D(nextPoint, currentPoint));
        let prevDir = firstDir;
        let prevNormal: Point2D;

        // Inner vertices
        for (let i = 1; i < numVertices - 1; i++) {
            const index = i + startIndex;
            vertexOffset = index * 2;
            const normalOffset = index * 4;
            // Middle vertices
            currentPoint = {x: vertexData[vertexOffset], y: vertexData[vertexOffset + 1]};
            nextPoint = {x: vertexData[vertexOffset + 2], y: vertexData[vertexOffset + 3]};

            const currentDir = normalize2D(subtract2D(nextPoint, currentPoint));
            const currentNormal = perpVector2D(currentDir);
            const tangent = normalize2D(add2D(prevDir, currentDir));
            const tangentNormal = perpVector2D(tangent);
            const mitreLength = 1.0 / dot2D(tangent, prevDir);
            const computedNormal = scale2D(tangentNormal, mitreLength);

            ContourStore.FillNormals(normalData, normalOffset, computedNormal);

            prevNormal = currentNormal;
            prevDir = currentDir;
        }

        let firstNorm: Point2D, lastNorm: Point2D;

        // Test if the line is a closed loop
        const firstPoint = {x: vertexData[startIndex * 2], y: vertexData[startIndex * 2 + 1]};
        const lastPoint = {x: vertexData[(endIndex - 1) * 2], y: vertexData[(endIndex - 1) * 2 + 1]};
        const firstLastDist = length2D(subtract2D(firstPoint, lastPoint));
        const loop = firstLastDist < 1e-3;

        if (loop) {
            // Join first and last lines
            const tangent = normalize2D(add2D(prevDir, firstDir));
            const tangentNormal = perpVector2D(tangent);
            const mitreLength = 1.0 / dot2D(tangent, prevDir);
            firstNorm = scale2D(tangentNormal, mitreLength);
            lastNorm = firstNorm;
        } else {
            firstNorm = perpVector2D(firstDir);
            lastNorm = prevNormal;
        }

        // Fill in first and last normals
        ContourStore.FillNormals(normalData, startIndex * 4, firstNorm);
        ContourStore.FillNormals(normalData, (endIndex - 1) * 4, lastNorm);
    }

    private static FillNormals(normalData: Float32Array, offset: number, normal: Point2D) {
        normalData[offset] = normal.x;
        normalData[offset + 1] = normal.y;
        normalData[offset + 2] = -normal.x;
        normalData[offset + 3] = -normal.y;
    }

    private static GenerateLineIndices(indexOffsets: Int32Array, numVertices: number) {
        const numPolyLines = indexOffsets.length;
        const numLineSegments = 2 * (numVertices - numPolyLines);
        const normalData = new Float32Array(numVertices * 4);

        const indices = [];

        for (let i = 0; i < numPolyLines; i++) {
            const startIndex = indexOffsets[i];
            const endIndex = i < numPolyLines - 1 ? indexOffsets[i + 1] : numVertices;

            for (let j = startIndex; j < endIndex - 1; j++) {
                const offset = j * 2;
                indices.push(offset);
                indices.push(offset + 1);
                indices.push(offset + 3);
                indices.push(offset + 3);
                indices.push(offset + 2);
                indices.push(offset);
            }
        }

        return new Int32Array(indices);

        // const indices = new Int32Array(6 * (numLineSegments + 1));
        // let indexCounter = 0;
        // let lineCounter = 1;
        // let endVertex = (lineCounter === numPolyLines) ? numVertices - 1 : indexOffsets[lineCounter] / 2 - 1;
        // for (let i = 0; i < numVertices - 1; i++) {
        //     // end current polyline if we've reached the end vertex
        //     if (i >= endVertex) {
        //         endVertex = (lineCounter === numPolyLines) ? numVertices - 1 : indexOffsets[lineCounter] / 2 - 1;
        //         lineCounter++;
        //     } else {
        //         const i0 = i * 2;
        //         indices[indexCounter] = i0;
        //         indices[indexCounter + 1] = i0 + 1;
        //         indices[indexCounter + 2] = i0 + 3;
        //         indices[indexCounter + 3] = i0 + 3;
        //         indices[indexCounter + 4] = i0 + 2;
        //         indices[indexCounter + 5] = i0;
        //         indexCounter += 6;
        //     }
        // }
        // return indices;
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