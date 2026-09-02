const AST = require("./build/index.js");

beforeAll(async () => {
    await AST.onReady;
});

test("parseDateToMJD accepts a real UTC leap second", () => {
    const leapSecondMjd = AST.parseDateToMJD("2016-12-31T23:59:60", "UTC");
    const followingMidnightMjd = AST.parseDateToMJD("2017-01-01T00:00:00", "UTC");

    expect(Number.isFinite(leapSecondMjd)).toBe(true);
    expect(leapSecondMjd).toEqual(followingMidnightMjd);
});

test("parseDateToMJD preserves fractional leap-second precision", () => {
    const leapSecondMjd = AST.parseDateToMJD("2016-12-31T23:59:60.25", "UTC");
    const projectedUtcMjd = AST.parseDateToMJD("2017-01-01T00:00:00.25", "UTC");

    expect(Number.isFinite(leapSecondMjd)).toBe(true);
    expect(Math.abs(leapSecondMjd - projectedUtcMjd) * 86400).toBeLessThan(1e-6);
});

test("parseDateToMJD rejects seconds 60 outside a real UTC leap second", () => {
    expect(Number.isNaN(AST.parseDateToMJD("2016-12-30T23:59:60", "UTC"))).toBe(true);
    expect(Number.isNaN(AST.parseDateToMJD("2016-12-31T23:59:60", "TAI"))).toBe(true);
});
