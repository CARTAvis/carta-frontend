const assert = require("node:assert/strict");
const {before, test} = require("node:test");

const AST = require("./build/index.js");

before(async () => {
    await AST.onReady;
});

test("parseDateToMJD accepts a real UTC leap second", () => {
    const leapSecondMjd = AST.parseDateToMJD("2016-12-31T23:59:60", "UTC");
    const followingMidnightMjd = AST.parseDateToMJD("2017-01-01T00:00:00", "UTC");

    assert.ok(Number.isFinite(leapSecondMjd));
    assert.equal(leapSecondMjd, followingMidnightMjd);
});

test("parseDateToMJD preserves fractional leap-second precision", () => {
    const leapSecondMjd = AST.parseDateToMJD("2016-12-31T23:59:60.25", "UTC");
    const projectedUtcMjd = AST.parseDateToMJD("2017-01-01T00:00:00.25", "UTC");

    assert.ok(Number.isFinite(leapSecondMjd));
    assert.ok(Math.abs(leapSecondMjd - projectedUtcMjd) * 86400 < 1e-6);
});

test("parseDateToMJD rejects seconds 60 outside a real UTC leap second", () => {
    assert.ok(Number.isNaN(AST.parseDateToMJD("2016-12-30T23:59:60", "UTC")));
    assert.ok(Number.isNaN(AST.parseDateToMJD("2016-12-31T23:59:60", "TAI")));
});
