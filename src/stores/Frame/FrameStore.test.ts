import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from "@jest/globals";
import * as AST from "ast_wrapper";

import {PreferenceKeys, RestFrameShiftMode, SkyRefIs, SpectralSystem, SpectralType, SpectralUnit, VelocityConvention} from "../../enums";
import * as SpectralDefinition from "../../models/Spectral/SpectralDefinition";
import {type FrameInfo, FrameStore, PreferenceStore} from "../index";

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
        axesNumbers: {spatialX: 1, spatialY: 2, spectral: 0, stokes: 0, depth: 0},
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

const OBS_TIME_FRAME_INFO: FrameInfo = {
    ...EMPTYFRAME_INFO,
    fileInfo: {HDUList: ["0"], name: "", size: 17280, type: 2} as any,
    fileInfoExtended: {
        dimensions: 2,
        width: 2,
        height: 2,
        depth: 1,
        stokes: 1,
        axesNumbers: {spatialX: 1, spatialY: 2, spectral: 0, stokes: 0, depth: 0},
        headerEntries: [
            {name: "CTYPE1", value: "RA---SIN"},
            {name: "CUNIT1", value: "deg"},
            {name: "CTYPE2", value: "DEC--SIN"},
            {name: "CUNIT2", value: "deg"},
            {name: "TIMESYS", value: "UTC"},
            {name: "MJD-OBS", value: "5.900025000000E+04", entryType: 1, numericValue: 59000.25},
            {name: "DATE-OBS", value: "2020-05-31T06:00:00"}
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

        test("returns the beam area in pixels", () => {
            const frame = new FrameStore(STOKES_CUBEFRAME_INFO);
            const beam = frame.beamProperties;
            expect(beam).not.toBeNull();
            expect(beam!.beamAreaPixels).toBeCloseTo((Math.PI / (4 * Math.LN2)) * beam!.x * beam!.y);
        });

        test("returns beam properties for the requested stokes", () => {
            const frame = new FrameStore(STOKES_CUBEFRAME_INFO);
            const beam = frame.getBeamProperties(1);
            expect(beam).toHaveProperty("majorAxis", 0.931560754776001);
            expect(beam).toHaveProperty("minorAxis", 0.8433191776275635);
            expect(beam).toHaveProperty("angle", 42.579010009765625);
        });

        test("uses pixel angular sizes for beam axes", () => {
            const frame = new FrameStore(STOKES_CUBEFRAME_INFO);
            const beam = frame.beamProperties;
            const pixelUnitSizeArcsec = frame.pixelUnitSizeArcsec;
            expect(beam).not.toBeNull();
            expect(pixelUnitSizeArcsec).not.toBeNull();
            expect(beam!.x).toBeCloseTo(beam!.majorAxis / pixelUnitSizeArcsec!.x);
            expect(beam!.y).toBeCloseTo(beam!.minorAxis / pixelUnitSizeArcsec!.y);
        });

        test("returns the beam area in steradians", () => {
            const frame = new FrameStore(STOKES_CUBEFRAME_INFO);
            const beam = frame.beamProperties;
            expect(beam).not.toBeNull();
            expect(beam!.beamArea).toBeCloseTo((Math.PI / (4 * Math.LN2)) * ((beam!.majorAxis * Math.PI) / 648000) * ((beam!.minorAxis * Math.PI) / 648000));
        });

        test("does not return beam areas without a valid beam", () => {
            const frame = new FrameStore(EMPTYFRAME_INFO);
            expect(frame.beamProperties).toBeNull();
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
        let mockBeamAllChannels: ReturnType<typeof jest.spyOn>;
        let mockSpectralAxis: ReturnType<typeof jest.spyOn>;
        let mockChannelInfo: ReturnType<typeof jest.spyOn>;
        let mockGetFreqInGHz: ReturnType<typeof jest.spyOn>;
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

            const lastSettings = (AST.set as jest.Mock).mock.calls.at(-1)?.[1];
            expect(lastSettings).toContain("Format(1)=dms.*");
            expect(lastSettings).toContain('Unit(1)=""');
            expect(lastSettings).toContain("Unit(2)=GHz");
            expect(lastSettings).toContain("StdOfRest=LSRK");
            expect(lastSettings).toContain("Label(2)=[LSRK] Frequency");
        });
    });

    describe("axis zoom", () => {
        test("sets zoomAxis and copies to spatialReference", () => {
            const frame = new FrameStore(EMPTYFRAME_INFO);
            const spatialRef = new FrameStore(EMPTYFRAME_INFO);
            frame["spatialReference"] = spatialRef;

            expect(frame.zoomAxis).toBe("x");
            frame.setZoomAxis("x");
            expect(frame.zoomAxis).toBe("x");
            expect(spatialRef.zoomAxis).toBe("x");
        });

        test("defaults PV and rotated cube zoom to the spectral axis", () => {
            const frame = new FrameStore(EMPTYFRAME_INFO);
            frame["frameInfo"] = {
                ...EMPTYFRAME_INFO,
                fileInfoExtended: {
                    ...EMPTYFRAME_INFO.fileInfoExtended,
                    axesNumbers: {spatialX: 1, spatialY: 2},
                    headerEntries: [
                        {name: "CTYPE1", value: "OFFSET"},
                        {name: "CTYPE2", value: "FREQ"}
                    ]
                }
            } as any;
            expect(frame.defaultZoomAxis).toBe("y");

            frame["frameInfo"] = {
                ...frame["frameInfo"],
                fileInfoExtended: {
                    ...frame["frameInfo"].fileInfoExtended,
                    headerEntries: [
                        {name: "CTYPE1", value: "VRAD"},
                        {name: "CTYPE2", value: "DISTANCE"}
                    ]
                }
            } as any;
            expect(frame.defaultZoomAxis).toBe("x");

            frame["frameInfo"] = ROTATED_STOKES_CUBEFRAME_INFO;
            expect(frame.defaultZoomAxis).toBe("y");
        });

        test("initializes preview zoom axis to the spectral axis", () => {
            const frameInfo = {
                ...EMPTYFRAME_INFO,
                preview: true,
                fileInfoExtended: {
                    ...EMPTYFRAME_INFO.fileInfoExtended,
                    axesNumbers: {spatialX: 1, spatialY: 2},
                    headerEntries: [
                        {name: "CTYPE1", value: "RA---SIN"},
                        {name: "CTYPE2", value: "FREQ"}
                    ]
                }
            } as any;
            const frame = new FrameStore(frameInfo);
            expect(frame.zoomAxis).toBe("y");
        });

        test("uses independent zoom levels for preview frames", () => {
            const frame = new FrameStore({...EMPTYFRAME_INFO, preview: true});

            frame.setAxisZoom(2, 4);

            expect(frame.effectiveZoomLevel).toEqual({x: 2, y: 4});
        });

        test("uses independent zoom levels for rotated spectral cubes", () => {
            const frame = new FrameStore(EMPTYFRAME_INFO) as Record<string, any>;
            frame["frameInfo"] = ROTATED_STOKES_CUBEFRAME_INFO;

            expect(frame.isAxisZoomable).toBe(true);
            frame.setAxisZoom(2, 4);

            expect(frame.effectiveZoomLevel).toEqual({x: 2, y: 4});
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

        test("converts setting WCS arrays to frequency with two batched transforms", () => {
            const frame = new FrameStore(EMPTYFRAME_INFO) as Record<string, any>;
            frame["spectralFrame"] = 1;
            frame["spectralSystem"] = SpectralSystem.LSRK;
            (AST.transformSpectralPointArray as jest.Mock).mockReturnValueOnce(new Float64Array([12, 24])).mockReturnValueOnce(new Float64Array([34, 68]));

            expect(frame.convertSettingWCSToFreqMHzArray([500, 1000], SpectralType.AWAV, SpectralUnit.NM)).toEqual([34, 68]);
            expect(AST.transformSpectralPointArray).toHaveBeenNthCalledWith(1, 1, SpectralType.AWAV, SpectralUnit.NM, SpectralSystem.LSRK, [500, 1000], false);
            expect(AST.transformSpectralPointArray).toHaveBeenNthCalledWith(2, 1, SpectralType.FREQ, SpectralUnit.MHZ, SpectralSystem.LSRK, new Float64Array([12, 24]));
        });

        test("converts frequency arrays to setting WCS with two batched transforms", () => {
            const frame = new FrameStore(EMPTYFRAME_INFO) as Record<string, any>;
            frame["spectralFrame"] = 1;
            frame["spectralSystem"] = SpectralSystem.LSRK;
            (AST.transformSpectralPointArray as jest.Mock).mockReturnValueOnce(new Float64Array([12, 24])).mockReturnValueOnce(new Float64Array([34, 68]));

            expect(frame.convertFreqMHzToSettingWCSArray([100, 200], SpectralType.AWAV, SpectralUnit.NM)).toEqual([34, 68]);
            expect(AST.transformSpectralPointArray).toHaveBeenNthCalledWith(1, 1, SpectralType.FREQ, SpectralUnit.MHZ, SpectralSystem.LSRK, [100, 200], false);
            expect(AST.transformSpectralPointArray).toHaveBeenNthCalledWith(2, 1, SpectralType.AWAV, SpectralUnit.NM, SpectralSystem.LSRK, new Float64Array([12, 24]));
        });

        test("stops an array conversion when the AST wrapper reports invalid output", () => {
            const frame = new FrameStore(EMPTYFRAME_INFO) as Record<string, any>;
            frame["spectralFrame"] = 1;
            frame["spectralSystem"] = SpectralSystem.LSRK;
            (AST.transformSpectralPointArray as jest.Mock).mockReturnValueOnce(new Float64Array([NaN, NaN]));

            expect(frame.convertSettingWCSToFreqMHzArray([500, 1000], SpectralType.AWAV, SpectralUnit.NM)).toBeUndefined();
            expect(AST.transformSpectralPointArray).toHaveBeenCalledTimes(1);
        });
    });

    const pvFrameInfo: FrameInfo = {
        fileId: 0,
        directory: "",
        hdu: "",
        fileInfo: {HDUList: ["0"], name: "", size: 17280, type: 3} as any,
        fileInfoExtended: {
            dimensions: 2,
            height: 2,
            width: 2,
            depth: 1,
            stokes: 0,
            axesNumbers: {spatialX: 1, spatialY: 2, spectral: 2},
            headerEntries: [
                {name: "CTYPE1", value: "OFFSET"},
                {name: "CRVAL1", value: "0", entryType: 1, numericValue: 0},
                {name: "CDELT1", value: "1", entryType: 1, numericValue: 1},
                {name: "CRPIX1", value: "1", entryType: 1, numericValue: 1},
                {name: "CUNIT1", value: "arcsec"},
                {name: "CTYPE2", value: "FREQ"},
                {name: "CRVAL2", value: "1.42040575E9", entryType: 1, numericValue: 1420405750},
                {name: "CDELT2", value: "100000", entryType: 1, numericValue: 100000},
                {name: "CRPIX2", value: "1", entryType: 1, numericValue: 1},
                {name: "CUNIT2", value: "Hz"},
                {name: "RESTFRQ", value: "1.42040575E9", entryType: 1, numericValue: 1420405750},
                {name: "SPECSYS", value: "LSRK"}
            ]
        } as any,
        fileFeatureFlags: 0,
        renderMode: 0,
        beamTable: [],
        lelExpr: false,
        generated: false
    };

    describe("rest-frame conversion settings", () => {
        const configureFrameSetIndexMocks = (initialNframe: number = 2, initialCurrent: number = 2) => {
            let nframe = initialNframe;
            let current = initialCurrent;
            (AST.getString as jest.Mock).mockImplementation((_object: unknown, attribute: string) => {
                if (attribute === "Current") {
                    return `${current}`;
                }
                if (attribute === "Nframe") {
                    return `${nframe}`;
                }
                return "mock";
            });
            (AST.addFrame as jest.Mock).mockImplementation(() => {
                current = ++nframe;
            });
        };

        beforeEach(() => {
            configureFrameSetIndexMocks();
        });

        test("defaults PV shift input to radio radial velocity", () => {
            const frame = new FrameStore(pvFrameInfo);

            expect(frame.restFrameShiftMode).toBe(RestFrameShiftMode.RADIAL_VELOCITY);
            expect(frame.restFrameVelocityConvention).toBe(VelocityConvention.RADIO);
            expect(frame.restFrameRadialVelocity).toBe(0);
        });

        test("initializes PV shift input from preferences", () => {
            const preferenceStore = PreferenceStore.Instance;
            preferenceStore.preferences.set(PreferenceKeys.SILENT_IMAGE_VIEW_REST_FRAME_SHIFT_MODE, RestFrameShiftMode.REDSHIFT);
            preferenceStore.preferences.set(PreferenceKeys.SILENT_IMAGE_VIEW_REST_FRAME_VELOCITY_CONVENTION, VelocityConvention.OPTICAL);
            preferenceStore.preferences.set(PreferenceKeys.SILENT_SPECTRAL_PROFILER_REST_FRAME_SHIFT_MODE, RestFrameShiftMode.RADIAL_VELOCITY);
            preferenceStore.preferences.set(PreferenceKeys.SILENT_SPECTRAL_PROFILER_REST_FRAME_VELOCITY_CONVENTION, VelocityConvention.RELATIVISTIC);

            const frame = new FrameStore(pvFrameInfo);

            expect(frame.restFrameShiftMode).toBe(RestFrameShiftMode.REDSHIFT);
            expect(frame.restFrameVelocityConvention).toBe(VelocityConvention.OPTICAL);

            preferenceStore.preferences.delete(PreferenceKeys.SILENT_IMAGE_VIEW_REST_FRAME_SHIFT_MODE);
            preferenceStore.preferences.delete(PreferenceKeys.SILENT_IMAGE_VIEW_REST_FRAME_VELOCITY_CONVENTION);
            preferenceStore.preferences.delete(PreferenceKeys.SILENT_SPECTRAL_PROFILER_REST_FRAME_SHIFT_MODE);
            preferenceStore.preferences.delete(PreferenceKeys.SILENT_SPECTRAL_PROFILER_REST_FRAME_VELOCITY_CONVENTION);
        });

        test("tracks and validates rest-frame shift settings", () => {
            const frame = new FrameStore(pvFrameInfo) as Record<string, any>;
            frame["spectralType"] = SpectralType.FREQ;

            expect(frame.isRestFrameSupported).toBe(true);
            frame.setRestFrameEnabled(true);
            frame.setRestFrameRedshift(1);

            expect(frame.isRestFrameActive).toBe(true);
            expect(frame.restFrameFactor).toBe(2);

            frame.setRestFrameShiftMode(RestFrameShiftMode.RADIAL_VELOCITY);
            frame.setRestFrameVelocityConvention(VelocityConvention.OPTICAL);
            frame.setRestFrameRadialVelocity(299792.458);

            expect(frame.restFrameRedshift).toBe(1);
            expect(frame.restFrameRadialVelocity).toBeCloseTo(299792.458, 3);
        });

        test("disables rest-frame conversion for channel coordinates", () => {
            const frame = new FrameStore(pvFrameInfo) as Record<string, any>;
            frame["spectralType"] = SpectralType.FREQ;
            frame.setRestFrameEnabled(true);
            frame["spectralType"] = SpectralType.CHANNEL;
            frame.setRestFrameEnabled(true);

            expect(frame.isRestFrameSupported).toBe(false);
            expect(frame.isRestFrameEnabled).toBe(false);
            expect(frame.isRestFrameActive).toBe(false);
        });

        test("converts observed spectral values to rest frame correctly", () => {
            const frame = new FrameStore(pvFrameInfo) as Record<string, any>;
            frame.setRestFrameEnabled(true);
            frame.setRestFrameRedshift(0.5);

            // FREQ
            frame["spectralType"] = SpectralType.FREQ;
            frame["spectralUnit"] = SpectralUnit.GHZ;
            expect(frame.convertObservedSpectralValueToRestFrame(10)).toBeCloseTo(15);

            // WAVE
            frame["spectralType"] = SpectralType.WAVE;
            frame["spectralUnit"] = SpectralUnit.UM;
            expect(frame.convertObservedSpectralValueToRestFrame(15)).toBeCloseTo(10);

            // VRAD
            frame["spectralType"] = SpectralType.VRAD;
            frame["spectralUnit"] = SpectralUnit.KMS;
            expect(frame.convertObservedSpectralValueToRestFrame(0)).toBeCloseTo(-149896.229);

            // VOPT
            frame["spectralType"] = SpectralType.VOPT;
            frame["spectralUnit"] = SpectralUnit.KMS;
            expect(frame.convertObservedSpectralValueToRestFrame(0)).toBeCloseTo(-99930.81933);
        });

        test("applies PV WCS mappings when rest-frame conversion is enabled", () => {
            const frame = new FrameStore(pvFrameInfo) as Record<string, any>;
            frame["spectralType"] = SpectralType.VRAD;
            frame["spectralUnit"] = SpectralUnit.KMS;
            frame["spectralSystem"] = SpectralSystem.LSRK;
            (AST.scaleMap2D as jest.Mock).mockClear();
            (AST.shiftMap2D as jest.Mock).mockClear();
            (AST.addFrame as jest.Mock).mockClear();
            (AST.setI as jest.Mock).mockClear();

            frame.setRestFrameRedshift(0.5);
            frame.setRestFrameEnabled(true);

            expect(AST.scaleMap2D).toHaveBeenCalledWith(1, 1.5);
            expect(AST.shiftMap2D).toHaveBeenCalledWith(0, -149896.229);
            expect(AST.addFrame).toHaveBeenCalledTimes(2);
            expect(AST.setI).toHaveBeenCalledWith(expect.anything(), "Current", 4);
        });

        test("applies the custom RestFreq before caching the spectral frame", () => {
            const frame = new FrameStore(pvFrameInfo) as Record<string, any>;
            frame["spectralType"] = SpectralType.VRAD;
            frame["spectralUnit"] = SpectralUnit.KMS;
            frame["spectralSystem"] = SpectralSystem.LSRK;
            frame["restFreqStore"] = {restFreqInHz: 1.3e9};
            (AST.set as jest.Mock).mockClear();
            (AST.getSpectralFrame as jest.Mock).mockClear();

            frame.applyPVWcsSettings();

            const restFreqCallIndex = (AST.set as jest.Mock).mock.calls.findIndex(call => `${call[1]}`.includes("RestFreq=1300000000 Hz"));
            const spectralFrameCallOrder = (AST.getSpectralFrame as jest.Mock).mock.invocationCallOrder.at(-1);
            expect(restFreqCallIndex).toBeGreaterThanOrEqual(0);
            expect(spectralFrameCallOrder).toBeDefined();
            expect((AST.set as jest.Mock).mock.invocationCallOrder[restFreqCallIndex]).toBeLessThan(spectralFrameCallOrder as number);
            expect(frame["spectralFrame"]).toBe(1);
        });

        test("releases the PV FitsChan after building a FrameSet", () => {
            const frame = new FrameStore(pvFrameInfo) as Record<string, any>;
            const fitsChan = 41;
            (AST.emptyFitsChan as jest.Mock).mockReturnValue(fitsChan);
            (AST.deleteObject as jest.Mock).mockClear();

            frame["initPVFrame"]();

            expect(AST.deleteObject).toHaveBeenCalledWith(fitsChan);
        });

        test("releases the PV FitsChan when building a FrameSet fails", () => {
            const frame = new FrameStore(pvFrameInfo) as Record<string, any>;
            const fitsChan = 42;
            (AST.emptyFitsChan as jest.Mock).mockReturnValue(fitsChan);
            (AST.getFrameFromFitsChan as jest.Mock).mockImplementationOnce(() => {
                throw new Error("failed to parse PV WCS");
            });
            (AST.deleteObject as jest.Mock).mockClear();

            expect(() => frame["initPVFrame"]()).toThrow("failed to parse PV WCS");
            expect(AST.deleteObject).toHaveBeenCalledWith(fitsChan);
        });

        test("uses the actual FrameSet indices when adding rest-frame mappings", () => {
            const frame = new FrameStore(pvFrameInfo) as Record<string, any>;
            frame["spectralType"] = SpectralType.VRAD;
            frame["spectralUnit"] = SpectralUnit.KMS;
            frame["spectralSystem"] = SpectralSystem.LSRK;
            frame["isRestFrameEnabled"] = true;
            frame["restFrameRedshift"] = 0.5;
            configureFrameSetIndexMocks(3, 2);
            (AST.addFrame as jest.Mock).mockClear();
            (AST.setI as jest.Mock).mockClear();

            frame["addRestFrameWcsFrames"](1);

            expect(AST.addFrame).toHaveBeenNthCalledWith(1, 1, 2, expect.anything(), expect.anything());
            expect(AST.addFrame).toHaveBeenNthCalledWith(2, 1, 4, expect.anything(), expect.anything());
            expect(AST.setI).toHaveBeenCalledWith(1, "Current", 5);
        });

        test("uses a non-linear AST mapping for AWAV rest-frame conversion", () => {
            const frame = new FrameStore(pvFrameInfo) as Record<string, any>;
            frame["spectralType"] = SpectralType.AWAV;
            frame["spectralUnit"] = SpectralUnit.NM;
            frame["spectralSystem"] = SpectralSystem.LSRK;
            configureFrameSetIndexMocks(3, 2);
            (AST.getSpectralFrame as jest.Mock).mockClear();
            (AST.getSpectralFrame as jest.Mock).mockReturnValueOnce(101).mockReturnValueOnce(102).mockReturnValueOnce(103);
            (AST.createRestFrameMapping2D as jest.Mock).mockClear();
            (AST.scaleMap2D as jest.Mock).mockClear();
            (AST.shiftMap2D as jest.Mock).mockClear();
            (AST.addFrame as jest.Mock).mockClear();
            (AST.setI as jest.Mock).mockClear();
            (AST.deleteObject as jest.Mock).mockClear();

            frame.setRestFrameRedshift(1);
            frame.setRestFrameEnabled(true);

            expect(AST.createRestFrameMapping2D).toHaveBeenCalledWith(103, 2, 2);
            expect(AST.scaleMap2D).not.toHaveBeenCalled();
            expect(AST.shiftMap2D).not.toHaveBeenCalled();
            expect(AST.addFrame).toHaveBeenCalledTimes(1);
            expect(AST.addFrame).toHaveBeenCalledWith(expect.anything(), 2, expect.anything(), expect.anything());
            expect(AST.setI).toHaveBeenCalledWith(expect.anything(), "Current", 4);
            expect(AST.deleteObject).toHaveBeenCalledWith(103);
        });

        test("preserves a velocity scale close to the lower redshift limit", () => {
            const frame = new FrameStore(pvFrameInfo) as Record<string, any>;
            frame["spectralType"] = SpectralType.VRAD;
            frame["spectralUnit"] = SpectralUnit.KMS;
            frame["spectralSystem"] = SpectralSystem.LSRK;
            const redshift = -0.999999999999;
            (AST.scaleMap2D as jest.Mock).mockClear();

            frame.setRestFrameRedshift(redshift);
            frame.setRestFrameEnabled(true);

            expect(AST.scaleMap2D).toHaveBeenLastCalledWith(1, 1 + redshift);
        });

        test("preserves axis units with rest frame annotation on label when rest-frame conversion is enabled", () => {
            const frame = new FrameStore(pvFrameInfo) as Record<string, any>;
            frame["spectralType"] = SpectralType.VRAD;
            frame["spectralUnit"] = SpectralUnit.KMS;
            frame["spectralSystem"] = SpectralSystem.LSRK;
            (AST.set as jest.Mock).mockClear();
            (AST.getString as jest.Mock).mockImplementation((...args: unknown[]) => {
                switch (args[1]) {
                    case "Label(1)":
                        return "Offset";
                    case "Label(2)":
                        return "[LSRK] Radio velocity";
                    case "Unit(1)":
                        return "arcsec";
                    case "Unit(2)":
                        return "km/s";
                    case "Current":
                        return "2";
                    case "Nframe":
                        return "2";
                    default:
                        return "mock";
                }
            });

            frame.setRestFrameRedshift(0.5);
            frame.setRestFrameEnabled(true);

            expect(AST.set).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("Unit(2)=km/s"));
            expect(AST.set).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("Label(2)=[LSRK] Radio velocity"));
            expect(AST.set).toHaveBeenCalledWith(expect.anything(), "Label(1)=Offset");
            expect(AST.set).toHaveBeenCalledWith(expect.anything(), "Label(2)=[LSRK] Radio velocity (km/s) (rest frame)");
            expect(AST.set).toHaveBeenCalledWith(expect.anything(), "Unit(1)=arcsec");
            expect(AST.set).toHaveBeenCalledWith(expect.anything(), 'Unit(2)=""');
        });
    });

    describe("obsTimeMjdUtc", () => {
        test("prefers MJD-OBS over DATE-OBS", () => {
            const frame = new FrameStore(OBS_TIME_FRAME_INFO);
            expect(frame.obsTimeMjdUtc).toBe(59000.25);
            expect(AST.parseDateToMJD).not.toHaveBeenCalled();
        });

        test("falls back to DATE-OBS parsed in the TIMESYS scale", () => {
            const frameInfo = {
                ...OBS_TIME_FRAME_INFO,
                fileInfoExtended: {
                    ...OBS_TIME_FRAME_INFO.fileInfoExtended,
                    headerEntries: (OBS_TIME_FRAME_INFO.fileInfoExtended.headerEntries as any[]).filter(entry => entry.name !== "MJD-OBS")
                } as any
            };
            (AST.parseDateToMJD as jest.Mock).mockReturnValue(59000.25);
            (AST.convertMJD as jest.Mock).mockImplementation(mjd => mjd);

            const frame = new FrameStore(frameInfo);
            expect(frame.obsTimeMjdUtc).toBe(59000.25);
            expect(AST.parseDateToMJD).toHaveBeenCalledWith("2020-05-31T06:00:00", "UTC");
        });

        test("returns undefined without time headers", () => {
            const frame = new FrameStore(EMPTYFRAME_INFO);
            expect(frame.obsTimeMjdUtc).toBeUndefined();
        });
    });
});
