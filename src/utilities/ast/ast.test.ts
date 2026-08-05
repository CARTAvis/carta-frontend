import * as AST from "ast_wrapper";

import {CatalogSystemType, SystemType} from "../../enums";

import {ASTSettingsString, setAstStringSystem, setAstSystem} from "./ast";

const GS = (defaultSystem: SystemType, defaultEquinox: string, defaultEpoch: string) =>
    ({
        defaultSystem,
        defaultEquinox,
        defaultEpoch
    }) as any;

const AstOut = (system: SystemType | CatalogSystemType, global: any) => {
    const s = new ASTSettingsString();
    setAstStringSystem(s, system, global);
    return s.toString();
};

const DEFAULT_FK4 = GS(SystemType.FK4, "B1950.0", "B1953.2");
const DEFAULT_FK5 = GS(SystemType.FK5, "J2012.0", "J2000.0");
const DEFAULT_ICRS = GS(SystemType.ICRS, "J2000.0", "J2000.0");

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
    ] as Array<[string, SystemType, string]>)("applies FK4 overlay defaults for %s", (_description, system, expected) => {
        expect(AstOut(system, DEFAULT_FK4)).toBe(expected);
    });

    test.each([
        ["FK4 equinox and epoch", SystemType.FK4, "System=FK4, Equinox=B1950.0, Epoch=B1950.0"],
        ["FK5 equinox and epoch", SystemType.FK5, "System=FK5, Equinox=J2012.0, Epoch=J2000.0"],
        ["ICRS equinox and epoch", SystemType.ICRS, "System=ICRS, Equinox=J2000.0, Epoch=J2000.0"],
        ["Galactic equinox and epoch", SystemType.Galactic, "System=GALACTIC, Equinox=J2000.0, Epoch=J2000.0"],
        ["Ecliptic equinox and epoch", SystemType.Ecliptic, "System=ECLIPTIC, Equinox=J2000.0, Epoch=J2000.0"]
    ] as Array<[string, SystemType, string]>)("applies FK5 overlay defaults for %s", (_description, system, expected) => {
        expect(AstOut(system, DEFAULT_FK5)).toBe(expected);
    });

    test.each([
        ["FK4 equinox and epoch", SystemType.FK4, "System=FK4, Equinox=B1950.0, Epoch=B1950.0"],
        ["FK5 equinox and epoch", SystemType.FK5, "System=FK5, Equinox=J2000.0, Epoch=J2000.0"],
        ["ICRS equinox and epoch", SystemType.ICRS, "System=ICRS, Equinox=J2000.0, Epoch=J2000.0"],
        ["Galactic equinox and epoch", SystemType.Galactic, "System=GALACTIC, Equinox=J2000.0, Epoch=J2000.0"],
        ["Ecliptic equinox and epoch", SystemType.Ecliptic, "System=ECLIPTIC, Equinox=J2000.0, Epoch=J2000.0"]
    ] as Array<[string, SystemType, string]>)("applies ICRS overlay defaults and fallback for %s", (_description, system, expected) => {
        expect(AstOut(system, DEFAULT_ICRS)).toBe(expected);
    });

    test.each([
        [SystemType.FK4, "B1975.0", "B1975.0", "System=FK4, Equinox=B1975.0, Epoch=B1975.0"],
        [SystemType.FK5, "J2015.5", "J2000.0", "System=FK5, Equinox=J2015.5, Epoch=J2000.0"],
        [SystemType.ICRS, "J2000.0", "J2000.0", "System=ICRS, Equinox=J2000.0, Epoch=J2000.0"],
        [SystemType.Galactic, "J2000.0", "J2000.0", "System=GALACTIC, Equinox=J2000.0, Epoch=J2000.0"],
        [SystemType.Ecliptic, "J2020.0", "J2000.0", "System=ECLIPTIC, Equinox=J2020.0, Epoch=J2000.0"]
    ] as Array<[SystemType, string, string, string]>)("uses overlay defaults when defaultSystem=%s and system matches default", (defaultSystem, defaultEquinox, defaultEpoch, expected) => {
        const customGlobalSettings = GS(defaultSystem, defaultEquinox, defaultEpoch);
        expect(AstOut(defaultSystem, customGlobalSettings)).toBe(expected);
    });

    test.each([
        ["Galactic matches defaultSystem", SystemType.Galactic, SystemType.Galactic, "J2000.0", "J2000.0", "System=GALACTIC, Equinox=J2000.0, Epoch=J2000.0"],
        ["ICRS with FK4 defaultSystem (fallback)", SystemType.ICRS, SystemType.FK4, "B1975.0", "B1975.0", "System=ICRS, Equinox=J2000.0, Epoch=J2000.0"],
        ["FK4 matches defaultSystem with custom values", SystemType.FK4, SystemType.FK4, "B1975.0", "B1975.0", "System=FK4, Equinox=B1975.0, Epoch=B1975.0"]
    ] as Array<[string, SystemType, SystemType, string, string, string]>)("%s", (_desc, system, defaultSys, equinox, epoch, expected) => {
        const customGlobalSettings = GS(defaultSys, equinox, epoch);
        expect(AstOut(system, customGlobalSettings)).toBe(expected);
    });

    test.each([
        ["Image", SystemType.Image, "System=CARTESIAN"],
        ["Catalog Pixel0", CatalogSystemType.Pixel0, "System=Pixel0"],
        ["Catalog Pixel1", CatalogSystemType.Pixel1, "System=Pixel1"]
    ] as Array<[string, SystemType | CatalogSystemType, string]>)("%s system adds only System and no equinox/epoch", (_desc, system, expected) => {
        expect(AstOut(system, DEFAULT_FK5)).toBe(expected);
    });

    test.each([
        ["FK4", CatalogSystemType.FK4, DEFAULT_FK5, "System=FK4, Equinox=B1950.0, Epoch=B1950.0"],
        ["FK5", CatalogSystemType.FK5, DEFAULT_FK4, "System=FK5, Equinox=J2000.0, Epoch=J2000.0"],
        ["ICRS", CatalogSystemType.ICRS, DEFAULT_FK4, "System=ICRS, Equinox=J2000.0, Epoch=J2000.0"],
        ["Galactic", CatalogSystemType.Galactic, DEFAULT_FK5, "System=GALACTIC, Equinox=J2000.0, Epoch=J2000.0"],
        ["Ecliptic", CatalogSystemType.Ecliptic, DEFAULT_FK4, "System=ECLIPTIC, Equinox=J2000.0, Epoch=J2000.0"]
    ] as Array<[string, CatalogSystemType, any, string]>)("Catalog %s system uses standard equinox and epoch", (_desc, system, globalSettings, expected) => {
        expect(AstOut(system, globalSettings)).toBe(expected);
    });

    test.each([
        ["Ecliptic", SystemType.Ecliptic, "J2025.0", "System=ECLIPTIC, Equinox=J2025.0, Epoch=J2000.0"],
        ["FK5", SystemType.FK5, "J2030.0", "System=FK5, Equinox=J2030.0, Epoch=J2000.0"]
    ] as Array<[string, SystemType, string, string]>)("%s uses custom equinox and standard epoch when it is the default system", (_desc, system, customEquinox, expected) => {
        const customSettings = GS(system, customEquinox, "J2000.0");
        expect(AstOut(system, customSettings)).toBe(expected);
    });

    test.each([
        ["Ecliptic", SystemType.Ecliptic, DEFAULT_FK4, "System=ECLIPTIC, Equinox=J2000.0, Epoch=J2000.0"],
        ["FK5", SystemType.FK5, DEFAULT_FK4, "System=FK5, Equinox=J2000.0, Epoch=J2000.0"],
        ["Galactic", SystemType.Galactic, DEFAULT_FK5, "System=GALACTIC, Equinox=J2000.0, Epoch=J2000.0"]
    ] as Array<[string, SystemType, any, string]>)("%s system uses standard values when defaultSystem is different", (_desc, system, globalSettings, expected) => {
        expect(AstOut(system, globalSettings)).toBe(expected);
    });
});

describe("setAstSystem", () => {
    const frameSet = {} as AST.FrameSet;

    beforeEach(() => {
        (AST.set as jest.Mock).mockClear();
    });

    test("calls AST.set with correct settings string for a standard system", () => {
        setAstSystem(frameSet, SystemType.Galactic, DEFAULT_FK5);

        const mockSet = AST.set as jest.Mock;
        expect(mockSet).toHaveBeenCalledTimes(1);
        expect(mockSet).toHaveBeenCalledWith(frameSet, AstOut(SystemType.Galactic, DEFAULT_FK5));
    });

    test("calls AST.set for Image system", () => {
        setAstSystem(frameSet, SystemType.Image, DEFAULT_FK5);

        const mockSet = AST.set as jest.Mock;
        expect(mockSet).toHaveBeenCalledTimes(1);
        expect(mockSet).toHaveBeenCalledWith(frameSet, "System=CARTESIAN");
    });

    test("calls AST.set for catalog systems", () => {
        setAstSystem(frameSet, CatalogSystemType.ICRS, DEFAULT_FK5);

        const mockSet = AST.set as jest.Mock;
        expect(mockSet).toHaveBeenCalledTimes(1);
        expect(mockSet).toHaveBeenCalledWith(frameSet, AstOut(CatalogSystemType.ICRS, DEFAULT_FK5));
    });
});
