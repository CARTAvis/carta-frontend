import {ChannelType} from "./ChannelType";

export interface ChannelInfo {
    fromWCS: boolean;
    channelType: ChannelType;
    values: number[];
    rawValues: number[];
}