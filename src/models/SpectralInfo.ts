import {ChannelType} from "./SpectralDefinition";

export interface SpectralInfo {
    channel: number;
    channelType: ChannelType;
    specsys: string;
    spectralString: string;
    freqString?: string;
    velocityString?: string;
}