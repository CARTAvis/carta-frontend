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
        const isCompressed = contourSet.decimationFactor >= 1;

        let floatCoordinates: Float32Array;
        if (isCompressed) {
            // Decode raw coordinates from Zstd-compressed binary to a float array
            floatCoordinates = CARTACompute.Decode(contourSet.rawCoordinates, contourSet.uncompressedCoordinatesSize, contourSet.decimationFactor);
        } else {
            const u8Copy = contourSet.rawCoordinates.slice();
            floatCoordinates = new Float32Array(u8Copy.buffer);
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