import {AngularSizeUnit} from "enums";

import {AngularSize, FACTOR_TO_ARCSEC} from "./AngularSize";

describe("AngularSize", () => {
    describe("ConvertValueFromArcsec", () => {
        test("returns values with required unit", () => {
            expect(AngularSize.ConvertValueFromArcsec(1, AngularSizeUnit.ARCSEC)).toEqual(1);
            expect(AngularSize.ConvertValueFromArcsec(120, AngularSizeUnit.ARCMIN)).toEqual(2);
            expect(AngularSize.ConvertValueFromArcsec(7200, AngularSizeUnit.DEG)).toEqual(2);
            expect(AngularSize.ConvertValueFromArcsec(0.001, AngularSizeUnit.MILLIARCSEC)).toEqual(1);
        });

        test("returns nan if input arcsec is not finite", () => {
            expect(AngularSize.ConvertValueFromArcsec(NaN, AngularSizeUnit.ARCSEC)).toBeNaN();
        });
    });

    describe("ConvertFromArcsec", () => {
        let mockConvertValueFromArcsec: jest.SpyInstance;
        beforeAll(() => {
            mockConvertValueFromArcsec = jest.spyOn(AngularSize, "ConvertValueFromArcsec");
        });

        test("returns values with required unit", () => {
            mockConvertValueFromArcsec
                .mockImplementationOnce(() => 1)
                .mockImplementationOnce(() => 2)
                .mockImplementationOnce(() => 2);

            let size = AngularSize.ConvertFromArcsec(1);
            expect(mockConvertValueFromArcsec).toHaveBeenCalledWith(1, AngularSizeUnit.ARCSEC);
            expect(size?.value).toEqual(1);
            expect(size?.unit).toEqual(AngularSizeUnit.ARCSEC);

            size = AngularSize.ConvertFromArcsec(120);
            expect(mockConvertValueFromArcsec).toHaveBeenCalledWith(120, AngularSizeUnit.ARCMIN);
            expect(size?.value).toEqual(2);
            expect(size?.unit).toEqual(AngularSizeUnit.ARCMIN);

            size = AngularSize.ConvertFromArcsec(7200);
            expect(mockConvertValueFromArcsec).toHaveBeenCalledWith(7200, AngularSizeUnit.DEG);
            expect(size?.value).toEqual(2);
            expect(size?.unit).toEqual(AngularSizeUnit.DEG);
        });

        test("converts to milliarsec when needed", () => {
            mockConvertValueFromArcsec.mockImplementationOnce(() => 1).mockImplementationOnce(() => 0.001);

            let size = AngularSize.ConvertFromArcsec(0.001, true);
            expect(mockConvertValueFromArcsec).toHaveBeenCalledWith(0.001, AngularSizeUnit.MILLIARCSEC);
            expect(size?.value).toEqual(1);
            expect(size?.unit).toEqual(AngularSizeUnit.MILLIARCSEC);

            size = AngularSize.ConvertFromArcsec(0.001, false);
            expect(mockConvertValueFromArcsec).toHaveBeenCalledWith(0.001, AngularSizeUnit.ARCSEC);
            expect(size?.value).toEqual(0.001);
            expect(size?.unit).toEqual(AngularSizeUnit.ARCSEC);
        });

        test("returns nan if input arcsec is not finite", () => {
            const size = AngularSize.ConvertFromArcsec(NaN);
            expect(size?.value).toBeNaN();
            expect(size?.unit).toEqual(AngularSizeUnit.ARCSEC);
        });
    });

    describe("factor to arcsec", () => {
        test("has correct factors", () => {
            expect(FACTOR_TO_ARCSEC.get(AngularSizeUnit.DEG)).toEqual(3600);
            expect(FACTOR_TO_ARCSEC.get(AngularSizeUnit.ARCMIN)).toEqual(60);
            expect(FACTOR_TO_ARCSEC.get(AngularSizeUnit.ARCSEC)).toEqual(1);
            expect(FACTOR_TO_ARCSEC.get(AngularSizeUnit.MILLIARCSEC)).toEqual(0.001);
        });
    });
});
