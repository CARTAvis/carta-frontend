export interface ChannelInfo {
    fromWCS: boolean;
    indexes: number[];
    values: number[];
    rawValues: number[];
    getChannelIndexWCS: (x: number) => number;
    getChannelIndexSimple: (x: number) => number;
}