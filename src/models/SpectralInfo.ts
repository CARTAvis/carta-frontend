import {SpectralTypeSet} from "./SpectralDefinition";

export interface SpectralInfo {
    channel: number;
    channelType: SpectralTypeSet;
    specsys: string;
    spectralString: string;
    freqString?: string;
    velocityString?: string;
}