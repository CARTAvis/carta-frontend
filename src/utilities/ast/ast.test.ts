import * as AST from "ast_wrapper";

import {SystemType} from "../../stores";

import {ASTSettingsString, setAstStringSystem, setAstSystem} from "./ast";

jest.mock("ast_wrapper", () => ({
    __esModule: true,
    set: jest.fn(),
    setColor: jest.fn(),
    getString: jest.fn().mockReturnValue(""),
    fonts: []
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
});

describe("setAstStringSystem", () => {
    test("appends system with FK4 equinox and epoch", () => {
        const astString = new ASTSettingsString();
        setAstStringSystem(astString, SystemType.FK4);

        expect(astString.toString()).toBe("System=FK4, Equinox=B1950.0, Epoch=B1950.0");
    });

    test("appends equinox and epoch without system when skipped", () => {
        const astString = new ASTSettingsString();
        setAstStringSystem(astString, SystemType.FK5, true);

        expect(astString.toString()).toBe("Equinox=J2000.0, Epoch=J2000.0");
    });

    test("only adds system when no equinox or epoch applies", () => {
        const astString = new ASTSettingsString();
        setAstStringSystem(astString, SystemType.ICRS);

        expect(astString.toString()).toBe("System=ICRS");
    });
});

describe("setAstSystem", () => {
    const frameSet = {} as AST.FrameSet;

    beforeEach(() => {
        (AST.set as jest.Mock).mockClear();
    });

    test("sets system and equinox/epoch on FrameSet", () => {
        setAstSystem(frameSet, SystemType.Galactic);

        const mockSet = AST.set as jest.Mock;
        expect(mockSet).toHaveBeenCalledTimes(2);
        expect(mockSet).toHaveBeenNthCalledWith(1, frameSet, "System=GALACTIC");
        expect(mockSet).toHaveBeenNthCalledWith(2, frameSet, "Equinox=J2000.0, Epoch=J2000.0");
    });

    test("skips setting system when requested", () => {
        setAstSystem(frameSet, SystemType.Ecliptic, true);

        const mockSet = AST.set as jest.Mock;
        expect(mockSet).toHaveBeenCalledTimes(1);
        expect(mockSet).toHaveBeenCalledWith(frameSet, "Equinox=J2000.0, Epoch=J2000.0");
    });

    test("does not add equinox or epoch when unavailable", () => {
        setAstSystem(frameSet, SystemType.ICRS);

        const mockSet = AST.set as jest.Mock;
        expect(mockSet).toHaveBeenCalledTimes(1);
        expect(mockSet).toHaveBeenCalledWith(frameSet, "System=ICRS");
    });
});
