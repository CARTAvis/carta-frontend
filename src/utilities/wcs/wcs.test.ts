import * as AST from "ast_wrapper";

import {SpectralSystem, SpectralType, SpectralUnit} from "../../enums";

jest.mock("ast_wrapper", () => ({
    __esModule: true,
    fonts: [],
    transformSpectralPoint: jest.fn(),
    transformSpectralPointArray: jest.fn()
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

import {buildSwappedZWcsSettings, convertFreqMHzToSettingWCS, convertFreqMHzToSettingWCSArray, convertSettingWCSToFreqMHz, convertSettingWCSToFreqMHzArray, convertToNativeWCS, getSwappedDirAxisInfo} from "./wcs";

describe("spectral WCS conversion helpers", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("converts a selected WCS value to native WCS", () => {
        (AST.transformSpectralPoint as jest.Mock).mockReturnValue(34);

        expect(convertToNativeWCS(1, SpectralType.AWAV, SpectralUnit.NM, SpectralSystem.LSRK, 500)).toBe(34);
        expect(AST.transformSpectralPoint).toHaveBeenCalledWith(1, SpectralType.AWAV, SpectralUnit.NM, SpectralSystem.LSRK, 500, false);
    });

    test("converts frequency in MHz to a selected WCS value", () => {
        (AST.transformSpectralPoint as jest.Mock).mockReturnValueOnce(12).mockReturnValueOnce(34);

        expect(convertFreqMHzToSettingWCS(1, SpectralType.AWAV, SpectralUnit.NM, SpectralSystem.LSRK, 100)).toBe(34);
        expect(AST.transformSpectralPoint).toHaveBeenNthCalledWith(1, 1, SpectralType.FREQ, SpectralUnit.MHZ, SpectralSystem.LSRK, 100, false);
        expect(AST.transformSpectralPoint).toHaveBeenNthCalledWith(2, 1, SpectralType.AWAV, SpectralUnit.NM, SpectralSystem.LSRK, 12);
    });

    test("preserves zero when converting frequency in MHz to a selected WCS value", () => {
        (AST.transformSpectralPoint as jest.Mock).mockReturnValueOnce(0).mockReturnValueOnce(0);

        expect(convertFreqMHzToSettingWCS(1, SpectralType.AWAV, SpectralUnit.NM, SpectralSystem.LSRK, 100)).toBe(0);
    });

    test("converts selected WCS values to frequency arrays", () => {
        (AST.transformSpectralPointArray as jest.Mock).mockReturnValueOnce(new Float64Array([12, 24])).mockReturnValueOnce(new Float64Array([34, 68]));

        expect(convertSettingWCSToFreqMHzArray(1, SpectralType.AWAV, SpectralUnit.NM, SpectralSystem.LSRK, [500, 1000])).toEqual([34, 68]);
        expect(AST.transformSpectralPointArray).toHaveBeenNthCalledWith(1, 1, SpectralType.AWAV, SpectralUnit.NM, SpectralSystem.LSRK, [500, 1000], false);
        expect(AST.transformSpectralPointArray).toHaveBeenNthCalledWith(2, 1, SpectralType.FREQ, SpectralUnit.MHZ, SpectralSystem.LSRK, new Float64Array([12, 24]));
    });

    test("converts frequency arrays to a selected WCS", () => {
        (AST.transformSpectralPointArray as jest.Mock).mockReturnValueOnce(new Float64Array([12, 24])).mockReturnValueOnce(new Float64Array([34, 68]));

        expect(convertFreqMHzToSettingWCSArray(1, SpectralType.AWAV, SpectralUnit.NM, SpectralSystem.LSRK, [100, 200])).toEqual([34, 68]);
        expect(AST.transformSpectralPointArray).toHaveBeenNthCalledWith(1, 1, SpectralType.FREQ, SpectralUnit.MHZ, SpectralSystem.LSRK, [100, 200], false);
        expect(AST.transformSpectralPointArray).toHaveBeenNthCalledWith(2, 1, SpectralType.AWAV, SpectralUnit.NM, SpectralSystem.LSRK, new Float64Array([12, 24]));
    });

    test("returns undefined when a scalar AST conversion is invalid", () => {
        (AST.transformSpectralPoint as jest.Mock).mockReturnValue(NaN);

        expect(convertSettingWCSToFreqMHz(1, SpectralType.AWAV, SpectralUnit.NM, SpectralSystem.LSRK, 500)).toBeUndefined();
    });

    test("returns undefined when an array AST conversion is invalid", () => {
        (AST.transformSpectralPointArray as jest.Mock).mockReturnValue(new Float64Array([NaN, NaN]));

        expect(convertSettingWCSToFreqMHzArray(1, SpectralType.AWAV, SpectralUnit.NM, SpectralSystem.LSRK, [500, 1000])).toBeUndefined();
        expect(AST.transformSpectralPointArray).toHaveBeenCalledTimes(1);
    });
});

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
