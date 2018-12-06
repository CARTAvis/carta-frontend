import {ChannelType} from "./ChannelType";

export interface SpectralInfo {
    channel: number;
    channelType: ChannelType;
    spectralString: string;
    freqString?: string;
    velocityString?: string;
}