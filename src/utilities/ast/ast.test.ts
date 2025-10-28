import * as AST from "ast_wrapper";

import {CatalogSystemType} from "../../models";
import {SystemType} from "../../stores";

import {ASTSettingsString, setAstStringSystem, setAstSystem} from "./ast";

const gs = (defaultSystem: SystemType, defaultEquinox: string, defaultEpoch: string) => ({
    defaultSystem,
    defaultEquinox,
    defaultEpoch
} as any);

const astOut = (system: SystemType | CatalogSystemType, global: any, skipSystem: boolean = false) => {
    const s = new ASTSettingsString();
    setAstStringSystem(s, system, global, skipSystem);
    return s.toString();
};

const defaultFK4 = gs(SystemType.FK4, "B1950.0", "B1953.2");
const defaultFK5 = gs(SystemType.FK5, "J2012.0", "J2000.0");
const defaultICRS = gs(SystemType.ICRS, "J2000.0", "J2000.0");

jest.mock("ast_wrapper", () => ({
    __esModule: true,
    set: jest.fn(),
    setColor: jest.fn(),
    getString: jest.fn().mockReturnValue(""),
    fonts: []
}));

// Mock heavy modules to avoid initializing MobX decorators and React trees in tests.
jest.mock("../../stores", () => ({
    __esModule: true,
    SystemType: {
        Auto: "AUTO",
        Ecliptic: "ECLIPTIC",
        FK4: "FK4",
        FK5: "FK5",
        Galactic: "GALACTIC",
        ICRS: "ICRS",
        Image: "CARTESIAN"
    }
}));

jest.mock("../../models", () => ({
    __esModule: true,
    CatalogSystemType: {
        Ecliptic: "ECLIPTIC",
        FK4: "FK4",
        FK5: "FK5",
        Galactic: "GALACTIC",
        ICRS: "ICRS",
        Pixel0: "Pixel0",
        Pixel1: "Pixel1"
    }
}));

describe("ASTSettingsString", () => {
    test("adds values and converts booleans to numeric flags", () => {
        const astString = new ASTSettingsString();
        astString.add("DrawTitle", true);
        astString.add("NumLab", false);
        astString.add("Size(NumLab)", 5);

        expect(astString.toString()).toBe("DrawTitle=1, NumLab=0, Size(NumLab)=5");
    });

    test("skips undefined values and optional entries", () => {
        const astString = new ASTSettingsString();
        astString.add("ShouldSkip", undefined);
        astString.add("DrawTitle", "title", false);
        astString.add("TextGapType", "plot");

        expect(astString.toString()).toBe("TextGapType=plot");
    });

    test("adds section entries and omits empty segments", () => {
        const astSection = new ASTSettingsString();
        astSection.add("DrawTitle", true);
        astSection.add("Font(Title)", "title_font");

        const astString = new ASTSettingsString();
        astString.addSection(astSection.toString());
        astString.add("TextLab", true);
        astString.add("Font(TextLab)", "textlab_font");

        expect(astString.toString()).toBe("DrawTitle=1, Font(Title)=title_font, TextLab=1, Font(TextLab)=textlab_font");
    });

    test("addSection(undefined) does nothing and toString remains unchanged", () => {
        const astString = new ASTSettingsString();
        astString.add("Size(NumLab)", 5);
        astString.addSection(undefined as any);
        expect(astString.toString()).toBe("Size(NumLab)=5");
    });

    test('addSection("") is omitted by toString filter', () => {
        const astString = new ASTSettingsString();
        astString.add("Size(NumLab)", 5);
        astString.addSection("");
        expect(astString.toString()).toBe("Size(NumLab)=5");
    });
});

describe("setAstStringSystem", () => {
    test.each([
        ["FK4 equinox and epoch", SystemType.FK4, "System=FK4, Equinox=B1950.0, Epoch=B1953.2"],
        ["FK5 equinox and epoch", SystemType.FK5, "System=FK5, Equinox=J2000.0, Epoch=J2000.0"],
        ["ICRS equinox and epoch", SystemType.ICRS, "System=ICRS, Equinox=J2000.0, Epoch=J2000.0"],
        ["Galactic equinox and epoch", SystemType.Galactic, "System=GALACTIC, Equinox=J2000.0, Epoch=J2000.0"],
        ["Ecliptic equinox and epoch", SystemType.Ecliptic, "System=ECLIPTIC, Equinox=J2000.0, Epoch=J2000.0"]
    ] as Array<[string, SystemType, string]>)
    ("applies FK4 overlay defaults for %s", (_description, system, expected) => {
        expect(astOut(system, defaultFK4)).toBe(expected);
    });

    test.each([
        ["FK4 equinox and epoch", SystemType.FK4, "System=FK4, Equinox=B1950.0, Epoch=B1950.0"],
        ["FK5 equinox and epoch", SystemType.FK5, "System=FK5, Equinox=J2012.0, Epoch=J2000.0"],
        ["ICRS equinox and epoch", SystemType.ICRS, "System=ICRS, Equinox=J2000.0, Epoch=J2000.0"],
        ["Galactic equinox and epoch", SystemType.Galactic, "System=GALACTIC, Equinox=J2000.0, Epoch=J2000.0"],
        ["Ecliptic equinox and epoch", SystemType.Ecliptic, "System=ECLIPTIC, Equinox=J2000.0, Epoch=J2000.0"]
    ] as Array<[string, SystemType, string]>)
    ("applies FK5 overlay defaults for %s", (_description, system, expected) => {
        expect(astOut(system, defaultFK5)).toBe(expected);
    });

    test.each([
        ["FK4 equinox and epoch", SystemType.FK4, "System=FK4, Equinox=B1950.0, Epoch=B1950.0"],
        ["FK5 equinox and epoch", SystemType.FK5, "System=FK5, Equinox=J2000.0, Epoch=J2000.0"],
        ["ICRS equinox and epoch", SystemType.ICRS, "System=ICRS, Equinox=J2000.0, Epoch=J2000.0"],
        ["Galactic equinox and epoch", SystemType.Galactic, "System=GALACTIC, Equinox=J2000.0, Epoch=J2000.0"],
        ["Ecliptic equinox and epoch", SystemType.Ecliptic, "System=ECLIPTIC, Equinox=J2000.0, Epoch=J2000.0"]
    ] as Array<[string, SystemType, string]>)
    ("applies ICRS overlay defaults and fallback for %s", (_description, system, expected) => {
        expect(astOut(system, defaultICRS)).toBe(expected);
    });

    test.each([
        [SystemType.FK4, "B1975.0", "B1975.0", "System=FK4, Equinox=B1975.0, Epoch=B1975.0"],
        [SystemType.FK5, "J2015.5", "J2000.0", "System=FK5, Equinox=J2015.5, Epoch=J2000.0"],
        [SystemType.ICRS, "J2000.0", "J2000.0", "System=ICRS, Equinox=J2000.0, Epoch=J2000.0"],
        [SystemType.Galactic, "J2000.0", "J2000.0", "System=GALACTIC, Equinox=J2000.0, Epoch=J2000.0"],
        [SystemType.Ecliptic, "J2020.0", "J2000.0", "System=ECLIPTIC, Equinox=J2020.0, Epoch=J2000.0"]
    ] as Array<[SystemType, string, string, string]>)
    ("uses overlay defaults when defaultSystem=%s and system matches default", (defaultSystem, defaultEquinox, defaultEpoch, expected) => {
        const customGlobalSettings = gs(defaultSystem, defaultEquinox, defaultEpoch);
        expect(astOut(defaultSystem, customGlobalSettings)).toBe(expected);
    });

    test("appends equinox and epoch without system when skipped", () => {
        expect(astOut(SystemType.FK5, defaultFK5, true)).toBe("Equinox=J2012.0, Epoch=J2000.0");
    });

    test("skips system but adds FK4 equinox/epoch when skipSystem is true", () => {
        expect(astOut(SystemType.FK4, defaultFK5, true)).toBe("Equinox=B1950.0, Epoch=B1950.0");
    });

    test("uses overlay defaults when defaultSystem matches non-FK5 system", () => {
        const customGlobalSettings = gs(SystemType.Galactic, "J2000.0", "J2000.0");
        expect(astOut(SystemType.Galactic, customGlobalSettings)).toBe("System=GALACTIC, Equinox=J2000.0, Epoch=J2000.0");
    });

    test("falls back to J2000 when defaultSystem is FK4 and system is non-FK4", () => {
        const customGlobalSettings = gs(SystemType.FK4, "B1975.0", "B1975.0");
        expect(astOut(SystemType.ICRS, customGlobalSettings)).toBe("System=ICRS, Equinox=J2000.0, Epoch=J2000.0");
    });

    test("uses overlay defaults when defaultSystem is FK4 and system is FK4", () => {
        const customGlobalSettings = gs(SystemType.FK4, "B1975.0", "B1975.0");
        expect(astOut(SystemType.FK4, customGlobalSettings)).toBe("System=FK4, Equinox=B1975.0, Epoch=B1975.0");
    });

    test("skipSystem=true uses overlay defaults for non-FK4 when defaultSystem is FK5", () => {
        expect(astOut(SystemType.ICRS, defaultFK5, true)).toBe("Equinox=J2000.0, Epoch=J2000.0");
    });

    test("skipSystem=true uses overlay defaults when defaultSystem is FK5 and system is FK5", () => {
        const customGlobalSettings = gs(SystemType.FK5, "J2015.5", "J2000.0");
        expect(astOut(SystemType.FK5, customGlobalSettings, true)).toBe("Equinox=J2015.5, Epoch=J2000.0");
    });

    test("skipSystem=true uses overlay defaults when defaultSystem is Ecliptic and system is Ecliptic", () => {
        const customGlobalSettings = gs(SystemType.Ecliptic, "J2020.0", "J2000.0");
        expect(astOut(SystemType.Ecliptic, customGlobalSettings, true)).toBe("Equinox=J2020.0, Epoch=J2000.0");
    });

    test("skipSystem=true uses J2000/J2000 when defaultSystem is Galactic and system is Galactic", () => {
        const customGlobalSettings = gs(SystemType.Galactic, "J2000.0", "J2000.0");
        expect(astOut(SystemType.Galactic, customGlobalSettings, true)).toBe("Equinox=J2000.0, Epoch=J2000.0");
    });

    test("skipSystem=true uses J2000/J2000 when defaultSystem is ICRS and system is ICRS", () => {
        const customGlobalSettings = gs(SystemType.ICRS, "J2000.0", "J2000.0");
        expect(astOut(SystemType.ICRS, customGlobalSettings, true)).toBe("Equinox=J2000.0, Epoch=J2000.0");
    });

    test("skipSystem=true uses overlay defaults when defaultSystem is FK4 and system is FK4", () => {
        const customGlobalSettings = gs(SystemType.FK4, "B1975.0", "B1975.0");
        expect(astOut(SystemType.FK4, customGlobalSettings, true)).toBe("Equinox=B1975.0, Epoch=B1975.0");
    });

    test("Image system adds only System and no equinox/epoch", () => {
        expect(astOut(SystemType.Image, defaultFK5)).toBe("System=CARTESIAN");
    });

    test("Image system with skipSystem=true produces empty string", () => {
        expect(astOut(SystemType.Image, defaultFK5, true)).toBe("");
    });

    test("Catalog Pixel0 adds only System and no equinox/epoch", () => {
        expect(astOut(CatalogSystemType.Pixel0, defaultFK5)).toBe("System=Pixel0");
    });

    test("Catalog Pixel1 with skipSystem=true produces empty string", () => {
        expect(astOut(CatalogSystemType.Pixel1, defaultFK5, true)).toBe("");
    });
});

describe("setAstSystem", () => {
    const frameSet = {} as AST.FrameSet;

    beforeEach(() => {
        (AST.set as jest.Mock).mockClear();
    });

    test("sets system and equinox/epoch on FrameSet", () => {
        setAstSystem(frameSet, SystemType.Galactic, defaultFK5);

        const mockSet = AST.set as jest.Mock;
        expect(mockSet).toHaveBeenCalledTimes(1);
        expect(mockSet).toHaveBeenCalledWith(frameSet, astOut(SystemType.Galactic, defaultFK5));
    });

    test("does not add equinox or epoch for Image", () => {
        setAstSystem(frameSet, SystemType.Image, defaultFK5);

        const mockSet = AST.set as jest.Mock;
        expect(mockSet).toHaveBeenCalledTimes(1);
        expect(mockSet).toHaveBeenCalledWith(frameSet, astOut(SystemType.Image, defaultFK5));
    });

    test("skips setting FrameSet when Image skipSystem is true", () => {
        setAstSystem(frameSet, SystemType.Image, defaultFK5, true);

        const mockSet = AST.set as jest.Mock;
        expect(mockSet).not.toHaveBeenCalled();
    });

    test("sets catalog pixel system without equinox or epoch", () => {
        setAstSystem(frameSet, CatalogSystemType.Pixel0, defaultFK5);

        const mockSet = AST.set as jest.Mock;
        expect(mockSet).toHaveBeenCalledTimes(1);
        expect(mockSet).toHaveBeenCalledWith(frameSet, astOut(CatalogSystemType.Pixel0, defaultFK5));
    });

    test("skips setting FrameSet when catalog pixel skipSystem is true", () => {
        setAstSystem(frameSet, CatalogSystemType.Pixel1, defaultFK5, true);

        const mockSet = AST.set as jest.Mock;
        expect(mockSet).not.toHaveBeenCalled();
    });
});
