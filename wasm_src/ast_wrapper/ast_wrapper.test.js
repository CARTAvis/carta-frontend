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

test("createRestFrameMapping2D preserves the non-linear AWAV conversion", () => {
    const q = String.fromCharCode(39);
    const fitsChan = AST.emptyFitsChan();
    const cards = [
        "NAXIS   = 2",
        "NAXIS1  = 10",
        "NAXIS2  = 10",
        `CTYPE1  = ${q}LINEAR${q}`,
        `CTYPE2  = ${q}FREQ${q}`,
        `CUNIT1  = ${q}pix${q}`,
        `CUNIT2  = ${q}Hz${q}`,
        "CRPIX1  = 1",
        "CRPIX2  = 1",
        "CRVAL1  = 0",
        "CRVAL2  = 6.0E14",
        "CDELT1  = 1",
        "CDELT2  = 1.0E12"
    ];
    cards.forEach(card => AST.putFits(fitsChan, card));

    const frameSet = AST.getFrameFromFitsChan(fitsChan, false);
    AST.set(frameSet, "System(2)=AWAV,Unit(2)=nm");
    const spectralFrame = AST.getSpectralFrame(frameSet);
    const mapping = AST.createRestFrameMapping2D(spectralFrame, 2, 2);

    try {
        [500, 600, 1000].forEach(observedValue => {
            const observedFrequency = AST.transformSpectralPoint(spectralFrame, "FREQ", "Hz", null, observedValue);
            const expectedRestValue = AST.transformSpectralPoint(spectralFrame, "FREQ", "Hz", null, observedFrequency * 2, false);
            const actualRestValue = AST.transformPoint(mapping, 0, observedValue).y;
            expect(actualRestValue).toBeCloseTo(expectedRestValue, 10);
        });
    } finally {
        AST.deleteObject(mapping);
        AST.deleteObject(spectralFrame);
        AST.deleteObject(frameSet);
        AST.deleteObject(fitsChan);
    }
});

test("preserves valid spectral points when another point is invalid", () => {
    const q = String.fromCharCode(39);
    const fitsChan = AST.emptyFitsChan();
    const cards = [
        "NAXIS   = 2",
        "NAXIS1  = 10",
        "NAXIS2  = 10",
        `CTYPE1  = ${q}LINEAR${q}`,
        `CTYPE2  = ${q}FREQ${q}`,
        `CUNIT1  = ${q}pix${q}`,
        `CUNIT2  = ${q}Hz${q}`,
        "CRPIX1  = 1",
        "CRPIX2  = 1",
        "CRVAL1  = 0",
        "CRVAL2  = 1.42040575E9",
        "CDELT1  = 1",
        "CDELT2  = 1.0E6"
    ];
    cards.forEach(card => AST.putFits(fitsChan, card));

    const frameSet = AST.getFrameFromFitsChan(fitsChan, false);
    const spectralFrame = AST.getSpectralFrame(frameSet);

    try {
        const result = AST.transformSpectralPointArray(spectralFrame, "WAVE", "nm", null, [1.42040575e9, 0]);
        expect(Number.isFinite(result[0])).toBe(true);
        expect(Number.isNaN(result[1])).toBe(true);
    } finally {
        AST.deleteObject(spectralFrame);
        AST.deleteObject(frameSet);
        AST.deleteObject(fitsChan);
    }
});
