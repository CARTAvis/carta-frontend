import {CARTA} from "carta-protobuf";
// @ts-ignore
import * as CARTACompute from "carta_computation";

export interface ProcessedSpatialProfile extends CARTA.ISpatialProfile {
    values: Float32Array;
}

export interface ProcessedSpectralProfile extends CARTA.ISpectralProfile {
    values: Float32Array | Float64Array;
    progress: number;
}

export interface ProcessedContourData {
    fileId: number;
    imageBounds?: CARTA.IImageBounds;
    channel: number;
    stokes: number;
    progress: number;
    contourSets: ProcessedContourSet[];
}

export interface ProcessedContourSet {
    level: number;
    indexOffsets: Int32Array;
    coordinates: Float32Array;
}

export class ProtobufProcessing {
    static ProcessSpatialProfile(profile: CARTA.ISpatialProfile): ProcessedSpatialProfile {
        if (profile.rawValuesFp32 && profile.rawValuesFp32.length && profile.rawValuesFp32.length % 4 === 0) {
            return {
                coordinate: profile.coordinate,
                start: profile.start,
                end: profile.end,
                values: new Float32Array(profile.rawValuesFp32.slice().buffer)
            };
        }

        return {
            coordinate: profile.coordinate,
            start: profile.start,
            end: profile.end,
            values: null
        };
    }

    static ProcessSpectralProfile(profile: CARTA.ISpectralProfile, progress: number): ProcessedSpectralProfile {
        if (profile.rawValuesFp64 && profile.rawValuesFp64.length && profile.rawValuesFp64.length % 8 === 0) {
            return {
                coordinate: profile.coordinate,
                statsType: profile.statsType,
                values: new Float64Array(profile.rawValuesFp64.slice().buffer),
                progress
            };
        } else if (profile.rawValuesFp32 && profile.rawValuesFp32.length && profile.rawValuesFp32.length % 4 === 0) {
            return {
                coordinate: profile.coordinate,
                statsType: profile.statsType,
                values: new Float32Array(profile.rawValuesFp32.slice().buffer),
                progress
            };
        }

        return {
            coordinate: profile.coordinate,
            statsType: profile.statsType,
            values: null,
            progress: 0
        };
    }

    static ProcessContourSet(contourSet: CARTA.IContourSet): ProcessedContourSet {
        // TODO: Probably should not assume this module is ready
        contourSet.rawCoordinates = CARTACompute.Decompress(contourSet.rawCoordinates, contourSet.uncompressedCoordinatesSize);

        // TODO: This should be done in WebAssembly! Far too slow in JS. Eventually WebAssembly will also support SSE
        const floatCoordinates = new Float32Array(contourSet.rawCoordinates.buffer);
        const shuffledBytes = new Uint8Array(16);
        const shuffledIntegers = new Int32Array(shuffledBytes.buffer);
        let counter = 0;

        let v = 0;
        const N = floatCoordinates.length;
        const blockedLength = 4 * Math.floor(N / 4);

        // Un-shuffle data and convert from int to float based on decimation factor
        for (v = 0; v < blockedLength; v += 4) {
            const i = 4 * v;
            shuffledBytes[0] = contourSet.rawCoordinates[i];
            shuffledBytes[1] = contourSet.rawCoordinates[i + 4];
            shuffledBytes[2] = contourSet.rawCoordinates[i + 8];
            shuffledBytes[3] = contourSet.rawCoordinates[i + 12];
            shuffledBytes[4] = contourSet.rawCoordinates[i + 1];
            shuffledBytes[5] = contourSet.rawCoordinates[i + 5];
            shuffledBytes[6] = contourSet.rawCoordinates[i + 9];
            shuffledBytes[7] = contourSet.rawCoordinates[i + 13];
            shuffledBytes[8] = contourSet.rawCoordinates[i + 2];
            shuffledBytes[9] = contourSet.rawCoordinates[i + 6];
            shuffledBytes[10] = contourSet.rawCoordinates[i + 10];
            shuffledBytes[11] = contourSet.rawCoordinates[i + 14];
            shuffledBytes[12] = contourSet.rawCoordinates[i + 3];
            shuffledBytes[13] = contourSet.rawCoordinates[i + 7];
            shuffledBytes[14] = contourSet.rawCoordinates[i + 11];
            shuffledBytes[15] = contourSet.rawCoordinates[i + 15];

            floatCoordinates[v] = shuffledIntegers[0] / contourSet.decimationFactor;
            floatCoordinates[v + 1] = shuffledIntegers[1] / contourSet.decimationFactor;
            floatCoordinates[v + 2] = shuffledIntegers[2] / contourSet.decimationFactor;
            floatCoordinates[v + 3] = shuffledIntegers[3] / contourSet.decimationFactor;
            counter += 16;
        }

        const remainingBytes = contourSet.rawCoordinates.slice(v * 4);
        const remainingIntegers = new Int32Array(remainingBytes.buffer);
        for (let i = 0; i < remainingIntegers.length; i++, v++) {
            floatCoordinates[v] = remainingIntegers[i] / contourSet.decimationFactor;
        }

        let lastX = 0;
        let lastY = 0;

        for (let i = 0; i < N - 1; i += 2) {
            const deltaX = floatCoordinates[i];
            const deltaY = floatCoordinates[i + 1];
            lastX += deltaX;
            lastY += deltaY;
            floatCoordinates[i] = lastX;
            floatCoordinates[i + 1] = lastY;
        }

        // generate indices
        const indexOffsets = new Int32Array(contourSet.rawStartIndices.buffer.slice(contourSet.rawStartIndices.byteOffset, contourSet.rawStartIndices.byteOffset + contourSet.rawStartIndices.byteLength));

        return {
            level: contourSet.level,
            indexOffsets,
            coordinates: floatCoordinates
        };
    }

    static ProcessContourData(contourData: CARTA.IContourImageData): ProcessedContourData {
        return {
            fileId: contourData.fileId,
            channel: contourData.channel,
            stokes: contourData.stokes,
            imageBounds: contourData.imageBounds,
            progress: contourData.progress,
            contourSets: contourData.contourSets ? contourData.contourSets.map(contourSet => this.ProcessContourSet(contourSet)) : null
        };
    }
}