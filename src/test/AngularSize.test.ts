import {AngularSize, AngularSizeUnit} from "../models/AngularSize";

describe("AngularSize", () => {
    describe("convertValueFromArcsec", () => {
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

    describe("convertFromArcsec", () => {
        let mockConvertValueFromArcsec: jest.SpyInstance;
        beforeAll(() => {
            mockConvertValueFromArcsec = jest.spyOn(AngularSize, "convertValueFromArcsec");
        });

        test("returns values with required unit", () => {
            mockConvertValueFromArcsec
                .mockImplementationOnce(() => 1)
                .mockImplementationOnce(() => 2)
                .mockImplementationOnce(() => 2);

            let size = AngularSize.convertFromArcsec(1);
            expect(mockConvertValueFromArcsec).toBeCalledWith(1, AngularSizeUnit.ARCSEC);
            expect(size?.value).toEqual(1);
            expect(size?.unit).toEqual(AngularSizeUnit.ARCSEC);

            size = AngularSize.convertFromArcsec(120);
            expect(mockConvertValueFromArcsec).toBeCalledWith(120, AngularSizeUnit.ARCMIN);
            expect(size?.value).toEqual(2);
            expect(size?.unit).toEqual(AngularSizeUnit.ARCMIN);

            size = AngularSize.convertFromArcsec(7200);
            expect(mockConvertValueFromArcsec).toBeCalledWith(7200, AngularSizeUnit.DEG);
            expect(size?.value).toEqual(2);
            expect(size?.unit).toEqual(AngularSizeUnit.DEG);
        });

        test("converts to milliarsec when needed", () => {
            mockConvertValueFromArcsec.mockImplementationOnce(() => 1).mockImplementationOnce(() => 0.001);

            let size = AngularSize.convertFromArcsec(0.001, true);
            expect(mockConvertValueFromArcsec).toBeCalledWith(0.001, AngularSizeUnit.MILLIARCSEC);
            expect(size?.value).toEqual(1);
            expect(size?.unit).toEqual(AngularSizeUnit.MILLIARCSEC);

            size = AngularSize.convertFromArcsec(0.001, false);
            expect(mockConvertValueFromArcsec).toBeCalledWith(0.001, AngularSizeUnit.ARCSEC);
            expect(size?.value).toEqual(0.001);
            expect(size?.unit).toEqual(AngularSizeUnit.ARCSEC);
        });

        test("returns undefined if input arcsec is not finite", () => {
            const size = AngularSize.convertFromArcsec(NaN);
            expect(size?.value).toBeUndefined();
            expect(size?.unit).toEqual(AngularSizeUnit.ARCSEC);
        });
    });
});
