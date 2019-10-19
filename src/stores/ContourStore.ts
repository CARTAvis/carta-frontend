import {action, computed, observable} from "mobx";
import {Point2D} from "models";
import {add2D, dot2D, length2D, normalize2D, perpVector2D, scale2D, subtract2D} from "utilities";

export class ContourStore {
    @observable indices: Int32Array[];
    @observable indexOffsets: Int32Array[];
    @observable vertexData: Float32Array[];
    @observable lengthData: Float32Array[];
    @observable normalData: Float32Array[];
    @observable progress: number;

    vertexDataBuffers: WebGLBuffer[];
    vertexNormalBuffers: WebGLBuffer[];
    vertexLengthBuffers: WebGLBuffer[];
    indexBuffers: WebGLBuffer[];

    private gl: WebGLRenderingContext;
    private static MiterLimit = 1.5;

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
            count += this.vertexData[i].length / 4;
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

    @action addContourData = (indexOffsets: Int32Array, vertexData: Float32Array, progress: number) => {
        const numVertices = vertexData.length / 2;

        if (!this.vertexData) {
            this.vertexData = [];
        }
        if (!this.indexOffsets) {
            this.indexOffsets = [];
        }
        if (!this.normalData) {
            this.normalData = [];
        }
        if (!this.indices) {
            this.indices = [];
        }
        if (!this.lengthData) {
            this.lengthData = [];
        }

        this.vertexData.push(ContourStore.DuplicateVertexData(vertexData));
        this.indexOffsets.push(indexOffsets);
        this.normalData.push(ContourStore.GenerateLineNormals(vertexData, indexOffsets));
        this.indices.push(ContourStore.GenerateLineIndices(indexOffsets, numVertices));
        this.lengthData.push(ContourStore.GenerateLengthData(vertexData));
        this.progress = progress;
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
        const normalData = new Float32Array(numVertices * 4);

        for (let i = 0; i < numPolyLines; i++) {
            const startIndex = indexOffsets[i] / 2;
            const endIndex = i < numPolyLines - 1 ? indexOffsets[i + 1] / 2 : numVertices;
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

        let firstDir = normalize2D(subtract2D(nextPoint, currentPoint));

        if (!isFinite(firstDir.x) || !isFinite(firstDir.y)) {
            // Find first non-degenerate vertex and use that as the initial direction
            for (let i = 2; i < numVertices - 1; i++) {
                const newOffset = (startIndex + i) * 2;
                nextPoint = {x: vertexData[newOffset], y: vertexData[newOffset + 1]};
                firstDir = normalize2D(subtract2D(nextPoint, currentPoint));
                if (isFinite(firstDir.x) && isFinite(firstDir.y)) {
                    break;
                }
            }
        }
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

            let currentDir = normalize2D(subtract2D(nextPoint, currentPoint));
            // Handle degenerate vertices
            if (!isFinite(currentDir.x) || !isFinite(currentDir.y)) {
                currentDir = prevDir;
            }

            const currentNormal = perpVector2D(currentDir);
            const tangent = normalize2D(add2D(prevDir, currentDir));
            const tangentNormal = perpVector2D(tangent);
            let miterLength = Math.min(1.0 / dot2D(tangent, prevDir), ContourStore.MiterLimit);
            // Prevent mitre issues when going backwards
            if (isNaN(miterLength)) {
                miterLength = 1.0;
            }
            const computedNormal = scale2D(tangentNormal, miterLength);

            ContourStore.FillNormals(normalData, normalOffset, computedNormal);

            prevNormal = currentNormal;
            prevDir = currentDir;
        }

        let firstNorm: Point2D, lastNorm: Point2D;

        // Test if the line is a closed loop
        const firstPoint = {x: vertexData[startIndex * 2], y: vertexData[startIndex * 2 + 1]};
        const lastPoint = {x: vertexData[(endIndex - 1) * 2], y: vertexData[(endIndex - 1) * 2 + 1]};
        const firstLastDist = length2D(subtract2D(firstPoint, lastPoint));
        const loop = firstLastDist < 1e-6;

        if (loop) {
            // Join first and last lines
            const tangent = normalize2D(add2D(prevDir, firstDir));
            const tangentNormal = perpVector2D(tangent);
            const mitreLength = Math.min(1.0 / dot2D(tangent, prevDir), ContourStore.MiterLimit);
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
        if (!normal) {
            return;
        }

        normalData[offset] = normal.x;
        normalData[offset + 1] = normal.y;
        normalData[offset + 2] = -normal.x;
        normalData[offset + 3] = -normal.y;
    }

    private static GenerateLineIndices(indexOffsets: Int32Array, numVertices: number) {
        const numPolyLines = indexOffsets.length;
        const indices = [];

        for (let i = 0; i < numPolyLines; i++) {
            const startIndex = indexOffsets[i] / 2;
            const endIndex = i < numPolyLines - 1 ? indexOffsets[i + 1] / 2 : numVertices;

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
            lengths[i + 1] = -cumulativeLength;
        }
        return lengths;
    }

    @action generateBuffers(gl: WebGLRenderingContext, index: number) {
        if (!this.vertexDataBuffers) {
            this.vertexDataBuffers = [];
        }
        if (!this.vertexNormalBuffers) {
            this.vertexNormalBuffers = [];
        }
        if (!this.vertexLengthBuffers) {
            this.vertexLengthBuffers = [];
        }
        if (!this.indexBuffers) {
            this.indexBuffers = [];
        }

        // skip this if the buffers are already generated
        if (gl === this.gl && this.vertexDataBuffers[index] && this.vertexNormalBuffers[index] && this.vertexLengthBuffers[index] && this.indexBuffers[index]) {
            return;
        }

        if (this.vertexDataBuffers.length !== index) {
            console.log(`WebGL buffer index is incorrect!`);
        }

        // TODO: handle buffer cleanup when no longer needed
        this.gl = gl;
        this.indexBuffers.push(this.gl.createBuffer());
        this.vertexDataBuffers.push(this.gl.createBuffer());
        this.vertexLengthBuffers.push(this.gl.createBuffer());
        this.vertexNormalBuffers.push(this.gl.createBuffer());
        this.gl.bindBuffer(WebGLRenderingContext.ELEMENT_ARRAY_BUFFER, this.indexBuffers[index]);
        this.gl.bufferData(WebGLRenderingContext.ELEMENT_ARRAY_BUFFER, this.indices[index], WebGLRenderingContext.STATIC_DRAW);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexDataBuffers[index]);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, this.vertexData[index], WebGLRenderingContext.STATIC_DRAW);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexNormalBuffers[index]);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, this.normalData[index], WebGLRenderingContext.STATIC_DRAW);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexLengthBuffers[index]);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, this.lengthData[index], WebGLRenderingContext.STATIC_DRAW);
    }

    @action clearData = () => {
        this.indices = [];
        this.indexOffsets = [];
        this.vertexData = [];

        if (this.gl && this.vertexDataBuffers) {
            const numBuffers = this.vertexDataBuffers.length;
            for (let i = 0; i < numBuffers; i++) {
                this.gl.deleteBuffer(this.indexBuffers[i]);
                this.gl.deleteBuffer(this.vertexDataBuffers[i]);
                this.gl.deleteBuffer(this.vertexNormalBuffers[i]);
                this.gl.deleteBuffer(this.vertexLengthBuffers[i]);
            }
            this.indexBuffers = [];
            this.vertexDataBuffers = [];
            this.vertexLengthBuffers = [];
        }
    };
}