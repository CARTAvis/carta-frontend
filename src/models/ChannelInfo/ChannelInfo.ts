export interface ChannelInfo {
    fromWCS: boolean;
    delta: number;
    indexes: number[];
    values: number[];
    getChannelIndexWCS: (x: number) => number;
    getChannelIndexSimple: (x: number) => number;
}
