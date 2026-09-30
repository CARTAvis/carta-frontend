import "stores";

import {getImageFittingExportFileName} from "./FittingDialogComponent";

describe("getImageFittingExportFileName", () => {
    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 8, 23, 21, 40, 14));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test("follows the {file name}-{content}-{timestamp} pattern of the other exports", () => {
        expect(getImageFittingExportFileName("dice_one.fits", "2D_Fitting_Result")).toBe("dice_one.fits-2D_Fitting_Result-2026-09-23-21-40-14");
        expect(getImageFittingExportFileName("dice_one.fits", "2D_Fitting_Full_Log")).toBe("dice_one.fits-2D_Fitting_Full_Log-2026-09-23-21-40-14");
    });
});
