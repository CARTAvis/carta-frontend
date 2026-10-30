import * as AST from "ast_wrapper";

import {ImageType, SkyRefIs} from "enums/imageView";
import {configureAstOverlayWcs, getAstOverlayStyle, plotAstOverlay} from "utilities/ast/overlay";

import {renderAstOverlayToSvg} from "./astSvgExport";

jest.mock("ast_wrapper", () => ({...jest.requireActual("ast_wrapper"), setCanvas: jest.fn(), plot: jest.fn()}));
jest.mock("svgcanvas", () => ({Context: jest.fn().mockImplementation(() => ({scale: jest.fn(), translate: jest.fn(), getSvg: () => document.createElementNS("http://www.w3.org/2000/svg", "svg")}))}));

describe("AST export coordinate parity", () => {
    let frame: any;
    let settings: any;
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(AST.getLastErrorMessage).mockReturnValue("");
        jest.mocked(AST.copy).mockReturnValue(1 as never);
        jest.mocked(AST.getString).mockImplementation((_wcs, attribute) => (attribute === "Nframe" ? "9" : "2"));
        frame = {
            hasSquarePixels: true,
            aspectRatio: 1,
            effectiveZoomLevel: {x: 1, y: 1},
            isValidWcs: true,
            dirX: 1,
            dirY: 2,
            dirXLabel: "RA",
            dirYLabel: "Dec",
            wcsInfo: 1,
            wcsInfoOffset: 2,
            filename: "test.fits",
            requiredFrameView: {xMin: 10, xMax: 20, yMin: 30, yMax: 40},
            getWcsSizeInArcsec: () => ({x: 30, y: 30}),
            center: {x: 0, y: 0}
        };
        settings = {isWcsCoordinates: true, isImgCoordinates: false, numbers: {formatStringX: "hms", formatStringY: "dms"}, global: {explicitSystem: undefined}, labels: {hasCustomText: false}, title: {hasCustomText: false}};
    });

    test.each([true, false])("uses dynamic AST frame indices for non-square offset coordinates (image=%s)", isImgCoordinates => {
        frame.hasSquarePixels = false;
        frame.isOffsetCoord = true;
        settings.isImgCoordinates = isImgCoordinates;
        settings.isWcsCoordinates = !isImgCoordinates;
        configureAstOverlayWcs(1 as never, frame, settings, 2);
        expect(AST.setI).toHaveBeenCalledWith(1, "Base", 9);
        expect(AST.setI).toHaveBeenCalledWith(1, "Current", isImgCoordinates ? 9 : 2);
    });

    test("applies offset formatting after explicit coordinate formats", () => {
        frame.isOffsetCoord = true;
        settings.global.explicitSystem = "ICRS";
        configureAstOverlayWcs(1 as never, frame, settings, 1);
        const calls = jest.mocked(AST.set).mock.calls.map(call => call[1]);
        expect(calls[0]).toContain("Format(1)=hms");
        expect(calls.at(-1)).toBe("Format(1)=s.*, Format(2)=s.*, Unit(1)=arcsec, Unit(2)=arcsec");
    });

    test("uses Pole longitude degrees and latitude reference size", () => {
        frame.isOffsetCoord = true;
        frame.skyRefIs = SkyRefIs.Pole;
        jest.mocked(AST.transformPoint).mockReturnValue({x: 0, y: Math.PI / 4});
        configureAstOverlayWcs(1 as never, frame, settings, 1);
        expect(AST.set).toHaveBeenCalledWith(1, "Format(1)=d.*, Format(2)=d.*, Unit(1)=deg, Unit(2)=deg");
    });

    test.each(["isPVImage", "isSwappedZ"])("preserves spectral formatting for %s", property => {
        frame[property] = true;
        frame.spectralAxis = {valid: true};
        settings.global.explicitSystem = "ICRS";
        configureAstOverlayWcs(1 as never, frame, settings, 1);
        expect(AST.set).not.toHaveBeenCalled();
    });

    test("plots channel-map outer overlays in unscaled viewport coordinates", () => {
        const store = {viewWidth: 200, viewHeight: 120, padding: {left: 5, right: 10, top: 7, bottom: 13}, styleString: () => "Grid=0"};
        const image = {type: ImageType.FRAME, store: frame};
        expect(renderAstOverlayToSvg(store as never, image as never, settings, 2, true)).not.toBeNull();
        expect(AST.plot).toHaveBeenCalledWith(1, 10, 380, 26, 226, 400, 240, 10, 20, 14, 26, expect.any(String));
    });

    test("shares title escaping and invalid-WCS formatting cleanup", () => {
        frame.isValidWcs = false;
        frame.isOffsetCoord = true;
        const style = getAstOverlayStyle("System=ICRS, Format(1)=hms, Grid=1", frame, settings, {filename: 'image "50%"'});
        expect(style).not.toContain("System=");
        expect(style).not.toContain("Format(");
        expect(style).toContain('Title="image ”50%%%%”"');
        expect(style).toContain("LabelUnits=1");
    });

    test("shares the fallback to border-only plotting when AST cannot draw grid curves", () => {
        jest.mocked(AST.getLastErrorMessage).mockReturnValue("No grid curves can be drawn for axis 1");
        const plot = jest.fn();
        plotAstOverlay(plot, "Gap(1)=2, Gap(2)=3, Grid=1");
        expect(plot).toHaveBeenNthCalledWith(1, "Gap(1)=2, Gap(2)=3, Grid=1");
        expect(plot).toHaveBeenNthCalledWith(2, "Grid=0");
    });
});
