export interface ChannelInfo {
    fromWCS: boolean;
    indexes: number[];
    values: number[];
    getChannelIndexWCS: (x: number) => number;
    getChannelIndexSimple: (x: number) => number;
}
