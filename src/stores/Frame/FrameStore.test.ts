import * as AST from "ast_wrapper";

import {SkyRefIs, SpectralSystem, SpectralType, SpectralUnit} from "enums";
import {type FrameInfo, FrameStore} from "stores";

import * as SpectralDefinition from "../../models/Spectral/SpectralDefinition";

const STOKES_CUBEFRAME_INFO: FrameInfo = {
    fileId: 0,
    directory: "",
    hdu: "",
    fileInfo: {HDUList: ["0"], name: "", size: 17280, type: 3} as any,
    fileInfoExtended: {
        dimensions: 4,
        height: 2,
        width: 2,
        depth: 3,
        stokes: 2,
        axesNumbers: {spatialX: 1, spatialY: 2, spectral: 3, stokes: 4, depth: 3},
        headerEntries: [
            {name: "CTYPE1", value: "RA---SIN"},
            {name: "CRVAL1", value: "1.469895377994E+02", entryType: 1, numericValue: 146.9895377994},
            {name: "CDELT1", value: "-5.000000000000E-05", entryType: 1, numericValue: -0.00005},
            {name: "CRPIX1", value: "-2", entryType: 1, numericValue: -2},
            {name: "CUNIT1", value: "deg"},
            {name: "CTYPE2", value: "DEC--SIN"},
            {name: "CRVAL2", value: "1.327891127641E+01", entryType: 1, numericValue: 13.27891127641},
            {name: "CDELT2", value: "5.000000000000E-05", entryType: 1, numericValue: 0.00005},
            {name: "CRPIX2", value: "2", entryType: 1, numericValue: 2},
            {name: "CUNIT2", value: "deg"},
            {name: "CTYPE3", value: "FREQ"},
            {name: "CRVAL3", value: "3.440912937187E+11", entryType: 1, numericValue: 344091293718.7},
            {name: "CDELT3", value: "3.906722973755E+06", entryType: 1, numericValue: 3906722.973755},
            {name: "CRPIX3", value: "1", entryType: 1, numericValue: 1},
            {name: "CUNIT3", value: "Hz"},
            {name: "CTYPE4", value: "STOKES"},
            {name: "CRVAL4", value: "1.000000000000E+00", entryType: 1, numericValue: 1},
            {name: "CDELT4", value: "1.000000000000E+00", entryType: 1, numericValue: 1},
            {name: "CRPIX4", value: "1", entryType: 1, numericValue: 1},
            {name: "CUNIT4"}
        ]
    } as any,
    fileFeatureFlags: 0,
    renderMode: 0,
    beamTable: [
        {channel: 0, stokes: 0, majorAxis: 0.9315811991691589, minorAxis: 0.8433393239974976, pa: 42.576087951660156},
        {channel: 1, stokes: 0, majorAxis: 0.9315744042396545, minorAxis: 0.8433324098587036, pa: 42.5771484375},
        {channel: 2, stokes: 0, majorAxis: 0.9315680265426636, minorAxis: 0.843326985836029, pa: 42.57808303833008},
        {channel: 0, stokes: 1, majorAxis: 0.931560754776001, minorAxis: 0.8433191776275635, pa: 42.579010009765625},
        {channel: 1, stokes: 1, majorAxis: 0.9315542578697205, minorAxis: 0.8433099985122681, pa: 42.58040237426758},
        {channel: 2, stokes: 1, majorAxis: 0.9315447807312012, minorAxis: 0.8433027863502502, pa: 42.58256912231445}
    ] as any,
    lelExpr: false,
    generated: false
};

const EMPTYFRAME_INFO: FrameInfo = {
    fileId: 0,
    directory: "",
    hdu: "",
    fileInfo: {} as any,
    fileInfoExtended: {
        headerEntries: []
    } as any,
    fileFeatureFlags: 0,
    renderMode: 0,
    beamTable: [],
    lelExpr: false,
    generated: false
};

const ROTATED_STOKES_CUBEFRAME_INFO: FrameInfo = {
    ...EMPTYFRAME_INFO,
    fileInfo: {HDUList: ["0"], name: "", size: 17280, type: 3} as any,
    fileInfoExtended: {
        dimensions: 4,
        width: 512,
        height: 256,
        depth: 8,
        stokes: 2,
        axesNumbers: {spatialX: 4, spatialY: 1, spectral: 3, stokes: 2, depth: 3},
        headerEntries: [
            {name: "CTYPE1", value: "DEC--SIN"},
            {name: "CUNIT1", value: "deg"},
            {name: "CTYPE2", value: "STOKES"},
            {name: "CTYPE3", value: "FREQ"},
            {name: "CRVAL3", value: "3.440912937187E+11", entryType: 1, numericValue: 344091293718.7},
            {name: "CUNIT3", value: "Hz"},
            {name: "CTYPE4", value: "RA---SIN"},
            {name: "CUNIT4", value: "deg"},
            {name: "SPECSYS", value: "LSRK"}
        ]
    } as any
};

describe("FrameStore", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("offset coordinates", () => {
        test("rebuilds the offset frameset with the selected sky reference mode", () => {
            const frame = new FrameStore(STOKES_CUBEFRAME_INFO);
            frame.setOffsetCenter(1, 2);
            (AST.createOffsetFrameset as jest.Mock).mockClear();

            frame.toggleOffsetCoord();
            frame.setSkyRefIs(SkyRefIs.Pole);

            expect(frame.skyRefIs).toBe(SkyRefIs.Pole);
            expect(AST.createOffsetFrameset).toHaveBeenLastCalledWith(frame.wcsInfo, 0, 0, 1, 2, SkyRefIs.Pole);
        });
    });

    describe("beamProperties", () => {
        test("returns the beam of the current channel and stokes", () => {
            const frame = new FrameStore(STOKES_CUBEFRAME_INFO);
            const beam = frame.beamProperties;
            expect(beam).toHaveProperty("majorAxis", 0.9315811991691589);
            expect(beam).toHaveProperty("minorAxis", 0.8433393239974976);
            expect(beam).toHaveProperty("angle", 42.576087951660156);
        });
    });

    describe("beamAllChannels", () => {
        test("returns a list of beams from all channels with the current stokes", () => {
            const frame = new FrameStore(STOKES_CUBEFRAME_INFO);
            let beams = frame.beamAllChannels;
            expect(beams).toHaveLength(3);
            expect(beams[1]).toHaveProperty("majorAxis", 0.9315744042396545);
            expect(beams[1]).toHaveProperty("minorAxis", 0.8433324098587036);
            expect(beams[1]).toHaveProperty("pa", 42.5771484375);

            frame.setChannels(0, 1, false);
            beams = frame.beamAllChannels;
            expect(beams).toHaveLength(3);
            expect(beams[2]).toHaveProperty("majorAxis", 0.9315447807312012);
            expect(beams[2]).toHaveProperty("minorAxis", 0.8433027863502502);
            expect(beams[2]).toHaveProperty("pa", 42.58256912231445);
        });
    });

    describe("intensityConfig", () => {
        let mockBeamAllChannels: jest.SpyInstance;
        let mockSpectralAxis: jest.SpyInstance;
        let mockChannelInfo: jest.SpyInstance;
        let mockGetFreqInGHz: jest.SpyInstance;
        beforeAll(() => {
            mockBeamAllChannels = jest.spyOn(FrameStore.prototype, "beamAllChannels", "get");
            mockSpectralAxis = jest.spyOn(FrameStore.prototype, "spectralAxis", "get");
            mockChannelInfo = jest.spyOn(FrameStore.prototype, "channelInfo", "get");
            mockGetFreqInGHz = jest.spyOn(SpectralDefinition, "GetFreqInGHz");
        });

        afterAll(() => {
            mockBeamAllChannels.mockRestore();
            mockSpectralAxis.mockRestore();
            mockChannelInfo.mockRestore();
            mockGetFreqInGHz.mockRestore();
        });

        test("returns correct beam config", () => {
            mockBeamAllChannels.mockImplementation(() => [
                {majorAxis: 0.9315811991691589, minorAxis: 0.8433393239974976, pa: 42.576087951660156},
                {channel: 1, majorAxis: 0.9315744042396545, minorAxis: 0.8433324098587036, pa: 42.5771484375},
                {channel: 2, majorAxis: 0.9315680265426636, minorAxis: 0.843326985836029, pa: 42.57808303833008}
            ]);
            mockSpectralAxis.mockImplementation(() => {
                return {type: {code: "FREQ", unit: "GHz"}};
            });
            mockChannelInfo.mockImplementation(() => {
                return {values: [90.73634849111, 90.73631797353188, 90.73628745595375]};
            });
            mockGetFreqInGHz.mockImplementation((a, b) => b);

            const frame = new FrameStore(EMPTYFRAME_INFO);
            const config = frame.intensityConfig;
            expect(config["bmaj"]).toEqual([0.9315811991691589, 0.9315744042396545, 0.9315680265426636]);
            expect(config["bmin"]).toEqual([0.8433393239974976, 0.8433324098587036, 0.843326985836029]);
            expect(config["freqGHz"]).toEqual([90.73634849111, 90.73631797353188, 90.73628745595375]);
        });
    });

    describe("swapped spectral WCS updates", () => {
        beforeEach(() => {
            jest.clearAllMocks();
            (AST.makeSwappedFrameSet as jest.Mock).mockReturnValue(1);
        });

        test("reapplies spectral unit and system when the swapped WCS is rebuilt", () => {
            // Construct with EMPTYFRAME_INFO to avoid triggering the isSwappedZ constructor path
            // (which calls unmocked AST internals), then swap in the real frameInfo before testing.
            const frame = new FrameStore(EMPTYFRAME_INFO) as Record<string, any>;
            frame["frameInfo"] = ROTATED_STOKES_CUBEFRAME_INFO;
            frame["wcsInfo3D"] = 11;
            frame["wcsInfo"] = 7;
            frame["requiredChannel"] = 4;
            frame["spectralType"] = SpectralType.FREQ;
            frame["spectralUnit"] = SpectralUnit.GHZ;
            frame["spectralSystem"] = SpectralSystem.LSRK;
            frame["restFreqStore"] = {restFreqInHz: undefined};

            frame["updateDirAxisInfo"]();
            expect(frame.isSwappedZ).toBe(true);
            expect(frame.spectralAxis).toEqual(expect.objectContaining({valid: true}));
            frame.updateSpectralVsDirectionWcs();

            expect(AST.makeSwappedFrameSet).toHaveBeenCalledWith(11, 1, 2, 4, 512);

            const lastSettings = (AST.set as jest.Mock).mock.calls.at(-1)?.[1];
            expect(lastSettings).toContain("Format(1)=dms.*");
            expect(lastSettings).toContain('Unit(1)=""');
            expect(lastSettings).toContain("Unit(2)=GHz");
            expect(lastSettings).toContain("StdOfRest=LSRK");
            expect(lastSettings).toContain("Label(2)=[LSRK] Frequency");
        });
    });

    describe("spectral value conversion helpers", () => {
        test("converts an explicit setting WCS value to frequency in MHz", () => {
            const frame = new FrameStore(EMPTYFRAME_INFO) as Record<string, any>;
            frame["spectralFrame"] = 1;
            frame["spectralSystem"] = SpectralSystem.LSRK;
            (AST.transformSpectralPoint as jest.Mock).mockReturnValueOnce(12).mockReturnValueOnce(34);

            expect(frame.convertSettingWCSToFreqMHz(500, SpectralType.AWAV, SpectralUnit.NM)).toBe(34);
            expect(AST.transformSpectralPoint).toHaveBeenNthCalledWith(1, 1, SpectralType.AWAV, SpectralUnit.NM, SpectralSystem.LSRK, 500, false);
            expect(AST.transformSpectralPoint).toHaveBeenNthCalledWith(2, 1, SpectralType.FREQ, SpectralUnit.MHZ, SpectralSystem.LSRK, 12);
        });

        test("converts frequency in MHz to an explicit setting WCS", () => {
            const frame = new FrameStore(EMPTYFRAME_INFO) as Record<string, any>;
            frame["spectralFrame"] = 1;
            frame["spectralSystem"] = SpectralSystem.LSRK;
            (AST.transformSpectralPoint as jest.Mock).mockReturnValueOnce(12).mockReturnValueOnce(34);

            expect(frame.convertFreqMHzToSettingWCS(100, SpectralType.AWAV, SpectralUnit.NM)).toBe(34);
            expect(AST.transformSpectralPoint).toHaveBeenNthCalledWith(1, 1, SpectralType.FREQ, SpectralUnit.MHZ, SpectralSystem.LSRK, 100, false);
            expect(AST.transformSpectralPoint).toHaveBeenNthCalledWith(2, 1, SpectralType.AWAV, SpectralUnit.NM, SpectralSystem.LSRK, 12);
        });
    });
});
