import * as AST from "ast_wrapper";

import {SPECTRAL_DEFAULT_UNIT} from "models";

import {SpectralSystem, SpectralType, SpectralUnit} from "../../enums";

jest.mock("ast_wrapper", () => ({
    __esModule: true,
    copy: jest.fn(transform => transform),
    deleteObject: jest.fn(),
    fonts: [],
    set: jest.fn(),
    transform3DPoint: jest.fn()
}));

jest.mock("models", () => ({
    __esModule: true,
    SPECTRAL_DEFAULT_UNIT: new Map(),
    SPECTRAL_TYPE_STRING: new Map([["FREQ", "Frequency"]])
}));

jest.mock("stores", () => ({
    __esModule: true,
    OverlaySettings: {
        Instance: {
            isImgCoordinates: false
        }
    }
}));

jest.mock("stores/Frame", () => ({
    __esModule: true,
    RenderConfigStore: {
        COLOR_MAPS_CUSTOM: "custom",
        COLOR_MAPS_PANEL: "panel"
    },
    CURSOR_REGION_ID: 0
}));

import {buildSwappedZWcsSettings, getSwappedDirAxisInfo, transformChannelToFrame} from "./wcs";

describe("getSwappedDirAxisInfo", () => {
    test("returns galactic axis formats for swapped GLON/GLAT axes", () => {
        const result = getSwappedDirAxisInfo(3, 1, 512, 256, [{name: "CTYPE1", value: "GLON-TAN"}] as any, 10);

        expect(result).toEqual({
            dirAxis: 1,
            dirAxisSize: 512,
            dirAxisFormat: "d.*",
            depthAxisFormat: "d.10"
        });
    });

    test("returns RA/Dec style formats for non-galactic swapped axes", () => {
        const result = getSwappedDirAxisInfo(3, 1, 512, 256, [{name: "CTYPE1", value: "DEC--SIN"}] as any, 10);

        expect(result).toEqual({
            dirAxis: 1,
            dirAxisSize: 512,
            dirAxisFormat: "dms.*",
            depthAxisFormat: "hms.10"
        });
    });
});

describe("buildSwappedZWcsSettings", () => {
    test("includes spectral and directional settings in the expected order", () => {
        const settings = buildSwappedZWcsSettings({
            dirAxis: 1,
            dirAxisFormat: "dms.*",
            spectralAxis: 2,
            spectralType: SpectralType.FREQ,
            spectralUnit: SpectralUnit.GHZ,
            spectralSystem: SpectralSystem.LSRK,
            restFreqInHz: undefined,
            dirX: 3,
            dirXLabel: "",
            dirY: 1,
            dirYLabel: "Declination"
        });

        expect(settings).toBe('Format(1)=dms.*,Unit(1)="",System(2)=FREQ,Unit(2)=GHz,StdOfRest=LSRK,Label(2)=[LSRK] Frequency,Label(1)=Declination');
    });

    test("emits only direction format when all spectral properties are null", () => {
        const settings = buildSwappedZWcsSettings({
            dirAxis: 1,
            dirAxisFormat: "dms.*",
            spectralAxis: 2,
            spectralType: null,
            spectralUnit: null,
            spectralSystem: null,
            restFreqInHz: undefined,
            dirX: 3,
            dirXLabel: "",
            dirY: 1,
            dirYLabel: ""
        });

        expect(settings).toBe('Format(1)=dms.*,Unit(1)=""');
    });

    test("omits optional spectral labels and direction labels when values are absent", () => {
        const settings = buildSwappedZWcsSettings({
            dirAxis: 2,
            dirAxisFormat: "hms.*",
            spectralAxis: 1,
            spectralType: SpectralType.FREQ,
            spectralUnit: null,
            spectralSystem: null,
            restFreqInHz: 1420405751.0,
            dirX: 4,
            dirXLabel: "Right ascension",
            dirY: 2,
            dirYLabel: ""
        });

        expect(settings).toBe('Format(2)=hms.*,Unit(2)="",System(1)=FREQ,RestFreq=1420405751 Hz');
    });
});

describe("transformChannelToFrame", () => {
    test("uses the selected target channel when frames are only spatially matched", () => {
        const baseFrame = {requiredChannel: 2, spectralReference: null};
        const targetFrame = {requiredChannel: 7, spectralReference: null};

        expect(transformChannelToFrame(baseFrame as any, targetFrame as any, 4, SpectralType.FREQ)).toBe(7);
    });

    test("rounds only after transforming through a shared spectral reference", () => {
        const referenceFrame = {wcsInfo3D: "reference"};
        const baseFrame = {requiredChannel: 2, spectralReference: referenceFrame, wcsInfo3D: "base"};
        const targetFrame = {requiredChannel: 7, spectralReference: referenceFrame, wcsInfo3D: "target"};
        (SPECTRAL_DEFAULT_UNIT as Map<SpectralType, string>).set(SpectralType.FREQ, "Hz");
        (AST.transform3DPoint as jest.Mock).mockImplementation((transform, _x, _y, z, forward) => {
            if (transform === "base" && forward) {
                return {x: 0, y: 0, z: 16};
            }
            if (transform === "reference" && !forward) {
                return {x: 0, y: 0, z: z / 10};
            }
            if (transform === "reference" && forward) {
                return {x: 0, y: 0, z: z * 10};
            }
            if (transform === "target" && !forward) {
                return {x: 0, y: 0, z: z / 4};
            }
            return {x: 0, y: 0, z: 0};
        });

        expect(transformChannelToFrame(baseFrame as any, targetFrame as any, 3, SpectralType.FREQ)).toBe(4);
        expect(AST.transform3DPoint).toHaveBeenCalledWith("reference", 0, 0, 1.6, true);
    });
});
