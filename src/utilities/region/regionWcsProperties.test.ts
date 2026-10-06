import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";

import "stores";

import {getRegionWcsProperties, type RegionWcsContext} from "./region";

describe("getRegionWcsProperties", () => {
    const badX = 999;
    const context: RegionWcsContext = {
        wcsInfo: 1 as unknown as AST.FrameSet,
        system: "FK5",
        isDegreesX: false,
        isDegreesY: false,
        pixelUnitSizeArcsec: {x: 2, y: 3},
        precision: 4
    };

    beforeEach(() => {
        jest.spyOn(AST, "transformPoint").mockImplementation((_frame: unknown, x: number, y: number) => ({x, y}));
        jest.spyOn(AST, "normalizeCoordinates").mockImplementation((_frame: unknown, x: number, y: number) => ({x, y}));
        jest.spyOn(AST, "getFormattedCoordinates").mockImplementation((_frame: unknown, x: number, y: number) => (x === badX ? null : {x: `x${x}`, y: `y${y}`}));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("formats the shapes with the given system, sizes in arcsec and rotation", () => {
        expect(getRegionWcsProperties(CARTA.RegionType.POINT, [{x: 1, y: 2}], 0, context)).toBe("Point (wcs:FK5) [x1, y2]");
        expect(
            getRegionWcsProperties(
                CARTA.RegionType.ELLIPSE,
                [
                    {x: 1, y: 2},
                    {x: 5, y: 10}
                ],
                45,
                context
            )
        ).toBe('ellipse(wcs:FK5)[[x1, y2], [10.0000", 30.0000"], 45.000000deg]');
        expect(
            getRegionWcsProperties(
                CARTA.RegionType.POLYLINE,
                [
                    {x: 1, y: 2},
                    {x: 3, y: 4}
                ],
                0,
                context
            )
        ).toBe("Polyline (wcs:FK5)[[x1, y2], [x3, y4]]");
    });

    test("adds deg per axis in the degrees format, but not to placeholders", () => {
        const degrees = {...context, isDegreesX: true, isDegreesY: false};
        expect(
            getRegionWcsProperties(
                CARTA.RegionType.LINE,
                [
                    {x: 1, y: 2},
                    {x: badX, y: 4}
                ],
                0,
                degrees
            )
        ).toBe("Line (wcs:FK5) [[x1deg, y2], [Invalid, Invalid]]");
    });

    test("uses the center override and leaves sizes empty without a pixel size", () => {
        const withCursor = {...context, pixelUnitSizeArcsec: null, centerOverride: {x: "10:00:00", y: "20:00:00"}};
        expect(
            getRegionWcsProperties(
                CARTA.RegionType.RECTANGLE,
                [
                    {x: 1, y: 2},
                    {x: 5, y: 10}
                ],
                0,
                withCursor
            )
        ).toBe("rotbox(wcs:FK5)[[10:00:00, 20:00:00], [, ], 0.000000deg]");
    });

    test("returns undefined when the center cannot be converted", () => {
        expect(getRegionWcsProperties(CARTA.RegionType.POINT, [{x: NaN, y: 2}], 0, context)).toBeUndefined();
        expect(getRegionWcsProperties(CARTA.RegionType.POINT, [{x: badX, y: 2}], 0, context)).toBeUndefined();
        expect(getRegionWcsProperties(CARTA.RegionType.POINT, [], 0, context)).toBeUndefined();
    });
});
