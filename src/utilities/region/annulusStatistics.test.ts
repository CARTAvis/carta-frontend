import {CARTA} from "carta-protobuf";

import {getAnnulusSignalToNoise} from "./annulusStatistics";

const Packet = (mean: number) => new CARTA.RegionStatsData({fileId: 1, channel: 2, stokes: 0, statistics: [{statsType: CARTA.StatsType.Mean, value: mean}]});

test("computes both area/background directions and identical areas", () => {
    expect(getAnnulusSignalToNoise(Packet(8), Packet(3))).toBeCloseTo(5 / 3);
    expect(getAnnulusSignalToNoise(Packet(3), Packet(8))).toBe(-5 / 8);
    expect(getAnnulusSignalToNoise(Packet(8), Packet(8))).toBe(0);
});

test.each([0, NaN, Infinity])("handles invalid background mean %s", mean => {
    expect(getAnnulusSignalToNoise(Packet(8), Packet(mean))).toBeNaN();
});

test("rejects mismatched coordinates and missing means", () => {
    const background = Packet(3);
    background.channel++;
    expect(getAnnulusSignalToNoise(Packet(8), background)).toBeNaN();
    expect(getAnnulusSignalToNoise(Packet(8), new CARTA.RegionStatsData())).toBeNaN();
});
