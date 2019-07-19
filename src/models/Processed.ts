import {CARTA} from "carta-protobuf";

export interface ProcessedSpatialProfile extends CARTA.ISpatialProfile {
    values: Float32Array;
}

export interface ProcessedSpectralProfile extends CARTA.ISpectralProfile {
    values: Float32Array | Float64Array;
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

    static ProcessSpectralProfile(profile: CARTA.ISpectralProfile): ProcessedSpectralProfile {
        if (profile.rawValuesFp64 && profile.rawValuesFp64.length && profile.rawValuesFp64.length % 8 === 0) {
            return {
                coordinate: profile.coordinate,
                statsType: profile.statsType,
                values: new Float64Array(profile.rawValuesFp64.slice().buffer)
            };
        } else if (profile.rawValuesFp32 && profile.rawValuesFp32.length && profile.rawValuesFp32.length % 4 === 0) {
            return {
                coordinate: profile.coordinate,
                statsType: profile.statsType,
                values: new Float32Array(profile.rawValuesFp32.slice().buffer)
            };
        }

        return {
            coordinate: profile.coordinate,
            statsType: profile.statsType,
            values: null
        };
    }
}