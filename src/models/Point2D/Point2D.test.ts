jest.mock("utilities", () => ({
    toFixed: (value: number, decimals: number) => value.toFixed(decimals)
}));

import {WCSPoint2D} from "./Point2D";

test("rounds decimal WCS coordinates in the string representation", () => {
    expect(WCSPoint2D.toString({x: "123.456789", y: "-12.345678"}, 3)).toBe("(123.457, -12.346)");
});

test("preserves angle units while rounding decimal WCS coordinates", () => {
    expect(WCSPoint2D.toString({x: "123.456789 deg", y: '-12.345678"'}, 3)).toBe('(123.457 deg, -12.346")');
    expect(WCSPoint2D.toString({x: "123.456789'", y: "-12.345678 deg"}, 3)).toBe("(123.457', -12.346 deg)");
});

test("rounds the fractional part of sexagesimal WCS coordinates", () => {
    expect(WCSPoint2D.toString({x: "12:34:56.789", y: "-12:34:56.789"}, 2)).toBe("(12:34:56.79, -12:34:56.79)");
    expect(WCSPoint2D.toString({x: "12:34:56.789", y: "-12:34:56.789"}, 0)).toBe("(12:34:57, -12:34:57)");
    expect(WCSPoint2D.toString({x: "12:34:56.789 deg", y: "-12:34:56.789'"}, 2)).toBe("(12:34:56.79 deg, -12:34:56.79')");
});

test("leaves coordinates without decimals unchanged", () => {
    expect(WCSPoint2D.toString({x: "12:34:56", y: "180"}, 2)).toBe("(12:34:56, 180)");
    expect(WCSPoint2D.toString({x: "12:34:56", y: "180"})).toBe("(12:34:56, 180)");
});
