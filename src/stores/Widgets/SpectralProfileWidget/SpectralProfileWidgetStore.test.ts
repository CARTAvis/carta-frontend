import {CARTA} from "carta-protobuf";
import * as SpectralDefinition from "models/Spectral/SpectralDefinition.ts";
import {SpectralProfileWidgetStore, FrameStore} from "stores";

const emptyframeInfo = {
    fileId: 0,
    directory: "",
    hdu: "",
    fileInfo: new CARTA.FileInfo(),
    fileInfoExtended: new CARTA.FileInfoExtended(),
    fileFeatureFlags: 0,
    renderMode: 0,
    beamTable: []
};

describe("SpectralProfileWidgetStore", () => {
    describe("intensityConfig", () => {
        let mockEffectiveFrame: jest.SpyInstance;
        let mockBeamAllChannels: jest.SpyInstance;
        let mockSpectralAxis: jest.SpyInstance;
        let mockChannelInfo: jest.SpyInstance;
        let mockGetFreqInGHz: jest.SpyInstance;
        beforeAll(() => {
            mockEffectiveFrame = jest.spyOn(SpectralProfileWidgetStore.prototype, "effectiveFrame", "get");
            mockBeamAllChannels = jest.spyOn(FrameStore.prototype, "beamAllChannels", "get");
            mockSpectralAxis = jest.spyOn(FrameStore.prototype, "spectralAxis", "get");
            mockChannelInfo = jest.spyOn(FrameStore.prototype, "channelInfo", "get");
            mockGetFreqInGHz = jest.spyOn(SpectralDefinition, "GetFreqInGHz");
        });

        test("returns correct beam config", () => {
            mockEffectiveFrame.mockImplementation(() => new FrameStore(emptyframeInfo));
            mockBeamAllChannels.mockImplementation(() => [
                {majorAxis: 0.9315811991691589, minorAxis: 0.8433393239974976, pa: 42.576087951660156},
                {channel: 1, majorAxis: 0.9315744042396545, minorAxis: 0.8433324098587036, pa: 42.5771484375},
                {channel: 2, majorAxis: 0.9315680265426636, minorAxis: 0.843326985836029, pa: 42.57808303833008}
            ]);
            mockSpectralAxis.mockImplementation(() => {
                return {type: {code: "FREQ"}};
            });
            mockChannelInfo.mockImplementation(() => {
                return {values: [90.73634849111, 90.73631797353188, 90.73628745595375]};
            });
            mockGetFreqInGHz.mockImplementation((a, b) => b);

            const widgetStore = new SpectralProfileWidgetStore();
            const config = widgetStore.intensityConfig;
            expect(config["bmaj"]).toEqual([0.9315811991691589, 0.9315744042396545, 0.9315680265426636]);
            expect(config["bmin"]).toEqual([0.8433393239974976, 0.8433324098587036, 0.843326985836029]);
            expect(config["freqGHz"]).toEqual([90.73634849111, 90.73631797353188, 90.73628745595375]);
        });
    });
});
