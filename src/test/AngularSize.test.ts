import {AngularSize, AngularSizeUnit} from "../models/AngularSize";

describe("test convertValueFromArcsec", () => {
    test("returns values with required unit", () => {
        expect(AngularSize.convertValueFromArcsec(1, AngularSizeUnit.ARCSEC)).toEqual(1);
        expect(AngularSize.convertValueFromArcsec(120, AngularSizeUnit.ARCMIN)).toEqual(2);
        expect(AngularSize.convertValueFromArcsec(7200, AngularSizeUnit.DEG)).toEqual(2);
        expect(AngularSize.convertValueFromArcsec(0.001, AngularSizeUnit.MILLIARCSEC)).toEqual(1);
    });

    test("returns undefined if input arcsec is not finite", () => {
        expect(AngularSize.convertValueFromArcsec(NaN, AngularSizeUnit.ARCSEC)).toBeUndefined();
    });
});