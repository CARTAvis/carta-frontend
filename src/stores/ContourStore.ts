import {action, computed, observable} from "mobx";
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
    private static MiterLimit = 1.5;
    private static VertexDataElements = 10;

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

        this.vertexData.push(ContourStore.GenerateVertexData(sourceVertices, indexOffsets));
        this.indexOffsets.push(indexOffsets);
        this.indices.push(ContourStore.GenerateLineIndices(indexOffsets, numVertices));
        this.progress = progress;
    };

    private static GenerateVertexData(sourceVertices: Float32Array, indexOffsets: Int32Array) {
        const numPolyLines = indexOffsets.length;
        const numVertices = sourceVertices.length / 2;
        const vertexData = new Float32Array(numVertices * ContourStore.VertexDataElements);

        for (let i = 0; i < numPolyLines; i++) {
            const startIndex = indexOffsets[i] / 2;
            const endIndex = i < numPolyLines - 1 ? indexOffsets[i + 1] / 2 : numVertices;
            ContourStore.FillSinglePolyline(sourceVertices, startIndex, endIndex, vertexData);
        }
        return vertexData;
    }

    private static FillSinglePolyline(sourceVertices: Float32Array, startIndex: number, endIndex: number, vertexData: Float32Array) {
        const numVertices = endIndex - startIndex;
        if (numVertices < 2) {
            return;
        }

        // First vertex
        let vertexOffset = startIndex * 2;
        let currentPoint = {x: sourceVertices[vertexOffset], y: sourceVertices[vertexOffset + 1]};
        let nextPoint = {x: sourceVertices[vertexOffset + 2], y: sourceVertices[vertexOffset + 3]};

        let segmentLength = length2D(subtract2D(currentPoint, nextPoint));
        let cumulativeLength = segmentLength;

        let firstDir = normalize2D(subtract2D(nextPoint, currentPoint));

        if (!isFinite(firstDir.x) || !isFinite(firstDir.y)) {
            // Find first non-degenerate vertex and use that as the initial direction
            for (let i = 2; i < numVertices - 1; i++) {
                const newOffset = (startIndex + i) * 2;
                nextPoint = {x: sourceVertices[newOffset], y: sourceVertices[newOffset + 1]};
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
            const normalOffset = index * ContourStore.VertexDataElements;
            // Middle vertices
            currentPoint = {x: sourceVertices[vertexOffset], y: sourceVertices[vertexOffset + 1]};
            nextPoint = {x: sourceVertices[vertexOffset + 2], y: sourceVertices[vertexOffset + 3]};

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

            ContourStore.FillVertexData(vertexData, normalOffset, currentPoint, computedNormal, cumulativeLength);

            prevNormal = currentNormal;
            prevDir = currentDir;
            segmentLength = length2D(subtract2D(currentPoint, nextPoint));
            cumulativeLength += segmentLength;
        }

        let firstNorm: Point2D, lastNorm: Point2D;

        // Test if the line is a closed loop
        const firstPoint = {x: sourceVertices[startIndex * 2], y: sourceVertices[startIndex * 2 + 1]};
        const lastPoint = {x: sourceVertices[(endIndex - 1) * 2], y: sourceVertices[(endIndex - 1) * 2 + 1]};
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
        ContourStore.FillVertexData(vertexData, startIndex * ContourStore.VertexDataElements, firstPoint, firstNorm, 0);
        ContourStore.FillVertexData(vertexData, (endIndex - 1) * ContourStore.VertexDataElements, lastPoint, lastNorm, cumulativeLength);
    }

    private static FillVertexData(vertexData: Float32Array, offset: number, vertex: Point2D, normal: Point2D, length: number) {
        if (!normal || !vertex) {
            return;
        }

        vertexData[offset] = vertex.x;
        vertexData[offset + 1] = vertex.y;
        vertexData[offset + 2] = normal.x;
        vertexData[offset + 3] = normal.y;
        vertexData[offset + 4] = length;
        vertexData[offset + 5] = vertex.x;
        vertexData[offset + 6] = vertex.y;
        vertexData[offset + 7] = -normal.x;
        vertexData[offset + 8] = -normal.y;
        vertexData[offset + 9] = -length;

        // vertexData[offset] = vertex.x;
        // vertexData[offset + 1] = vertex.y;
        // vertexData[offset + 2] = normal.x;
        // vertexData[offset + 3] = normal.y;
        // vertexData[offset + 4] = vertex.x;
        // vertexData[offset + 5] = vertex.y;
        // vertexData[offset + 6] = -normal.x;
        // vertexData[offset + 7] = -normal.y;
    }

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