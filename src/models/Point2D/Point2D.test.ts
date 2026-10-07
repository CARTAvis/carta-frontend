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

test("preserves formatter precision and normalization for sexagesimal coordinates", () => {
    const point = {x: "23:59:59.9996", y: "-12:34:56.789"};
    expect(WCSPoint2D.toString(point, 3)).toBe("(23:59:59.9996, -12:34:56.789)");
    expect(WCSPoint2D.toString(point, 0)).toBe("(23:59:59.9996, -12:34:56.789)");
});

test("preserves decimal coordinate precision when using the WCS formatter output", () => {
    expect(WCSPoint2D.toString({x: "123.456789 deg", y: "-12.345678 deg"})).toBe("(123.456789 deg, -12.345678 deg)");
});

test("leaves coordinates without decimals unchanged", () => {
    expect(WCSPoint2D.toString({x: "12:34:56", y: "180"}, 2)).toBe("(12:34:56, 180)");
    expect(WCSPoint2D.toString({x: "12:34:56", y: "180"})).toBe("(12:34:56, 180)");
});
