export interface ChannelInfo {
    fromWCS: boolean;
    delta: number;
    indexes: number[];
    values: number[];
    rawValues: number[];
    getChannelIndexWCS: (x: number) => number;
    getChannelIndexSimple: (x: number) => number;
}
