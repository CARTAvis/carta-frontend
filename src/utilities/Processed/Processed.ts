import * as CARTACompute from "carta_computation";
import {CARTA} from "carta-protobuf";

export type TypedArray = Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;
export type ColumnArray = Array<string | null | undefined> | Array<boolean | undefined> | Array<number | undefined>;

export interface ProcessedSpatialProfile extends CARTA.ISpatialProfile {
    values: Float32Array | null;
}

export interface ProcessedSpectralProfile extends CARTA.ISpectralProfile {
    values: Float32Array | Float64Array | null;
    progress: number;
}

export interface ProcessedContourData {
    fileId: number | null | undefined;
    imageBounds?: CARTA.IImageBounds | null;
    channel: number | null | undefined;
    stokes: number | null | undefined;
    progress: number | null | undefined;
    contourSets: ProcessedContourSet[] | null;
}

export interface ProcessedContourSet {
    level: number | null | undefined;
    indexOffsets: Int32Array;
    coordinates: Float32Array | undefined;
}

export interface ProcessedColumnData {
    dataType: CARTA.ColumnType | null | undefined;
    data: ColumnArray | TypedArray | null | undefined;
}

export class ProtobufProcessing {
    static ProcessSpatialProfile(profile: CARTA.ISpatialProfile): ProcessedSpatialProfile {
        if (profile.rawValuesFp32 && profile.rawValuesFp32.length && profile.rawValuesFp32.length % 4 === 0) {
            return {
                coordinate: profile.coordinate,
                start: profile.start,
                end: profile.end,
                mip: profile.mip,
                values: new Float32Array(profile.rawValuesFp32.slice().buffer),
                lineAxis: profile.lineAxis
            };
        }

        return {
            coordinate: profile.coordinate,
            start: profile.start,
            end: profile.end,
            mip: profile.mip,
            values: null,
            lineAxis: profile.lineAxis
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
        const isCompressed = contourSet.decimationFactor && contourSet.decimationFactor >= 1;

        let floatCoordinates: Float32Array | undefined;
        if (isCompressed && contourSet.decimationFactor) {
            // Decode raw coordinates from Zstd-compressed binary to a float array
            if (contourSet.rawCoordinates && contourSet.uncompressedCoordinatesSize) {
                floatCoordinates = CARTACompute.Decode(contourSet.rawCoordinates, contourSet.uncompressedCoordinatesSize, contourSet.decimationFactor);
            }
        } else {
            const u8Copy = contourSet.rawCoordinates?.slice();
            if (u8Copy?.buffer) {
                floatCoordinates = new Float32Array(u8Copy.buffer);
            }
        }
        // generate indices
        let indexOffsets;
        if (contourSet.rawStartIndices) {
            indexOffsets = new Int32Array(contourSet.rawStartIndices.buffer.slice(contourSet.rawStartIndices.byteOffset, contourSet.rawStartIndices.byteOffset + contourSet.rawStartIndices.byteLength));
        }

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

    static GetProcessedData(column: CARTA.IColumnData): ProcessedColumnData {
        let data: TypedArray;
        switch (column.dataType) {
            case CARTA.ColumnType.Uint8:
                data = column.binaryData ? new Uint8Array(column.binaryData.slice().buffer) : new Uint8Array();
                break;
            case CARTA.ColumnType.Int8:
                data = column.binaryData ? new Int8Array(column.binaryData.slice().buffer) : new Int8Array();
                break;
            case CARTA.ColumnType.Uint16:
                data = column.binaryData ? new Uint16Array(column.binaryData.slice().buffer) : new Uint16Array();
                break;
            case CARTA.ColumnType.Int16:
                data = column.binaryData ? new Int16Array(column.binaryData.slice().buffer) : new Int16Array();
                break;
            case CARTA.ColumnType.Uint32:
                data = column.binaryData ? new Uint32Array(column.binaryData.slice().buffer) : new Uint32Array();
                break;
            case CARTA.ColumnType.Int32:
                data = column.binaryData ? new Int32Array(column.binaryData.slice().buffer) : new Int32Array();
                break;
            case CARTA.ColumnType.Float:
                data = column.binaryData ? new Float32Array(column.binaryData.slice().buffer) : new Float32Array();
                break;
            case CARTA.ColumnType.Double:
                data = column.binaryData ? new Float64Array(column.binaryData.slice().buffer) : new Float64Array();
                break;
            case CARTA.ColumnType.Int64:
                data = column.binaryData ? CARTACompute.ConvertInt64Array(column.binaryData, true) : new Float64Array();
                break;
            case CARTA.ColumnType.Uint64:
                data = column.binaryData ? CARTACompute.ConvertInt64Array(column.binaryData, false) : new Float64Array();
                break;
            case CARTA.ColumnType.Bool:
                const array = column.binaryData ? new Uint8Array(column.binaryData.slice().buffer) : new Uint8Array();
                const boolData = new Array<boolean>(array.length);
                for (let i = boolData.length - 1; i >= 0; i--) {
                    boolData[i] = array[i] !== 0;
                }
                return {dataType: column.dataType, data: boolData};
            case CARTA.ColumnType.String:
                return {dataType: column.dataType, data: column.stringData};
            default:
                return {dataType: CARTA.ColumnType.UnsupportedType, data: []};
        }
        return {dataType: column.dataType, data: data};
    }

    static ProcessCatalogData(catalogData: {[k: string]: CARTA.IColumnData}): Map<number, ProcessedColumnData> {
        const dataMap = new Map<number, ProcessedColumnData>();
        const originalMap = new Map(Object.entries(catalogData));
        originalMap.forEach((column, i) => {
            dataMap.set(parseInt(i), ProtobufProcessing.GetProcessedData(column));
        });

        return dataMap;
    }
}
