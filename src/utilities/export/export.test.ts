import {exportTsvFile, getExportFileName} from "./export";

describe("export file names", () => {
    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 8, 23, 21, 40, 14));
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test("follow the {file name}-{content}-{timestamp} pattern", () => {
        expect(getExportFileName("dice_one.fits", "2D_Fitting_Result")).toBe("dice_one.fits-2D_Fitting_Result-2026-09-23-21-40-14");
        expect(getExportFileName("dice_one.fits", "X-profile")).toBe("dice_one.fits-X-profile-2026-09-23-21-40-14");
    });

    test("replace every space in the image name with __ and in the content with -", () => {
        expect(getExportFileName("image IQU v2.fits", "PI profile smoothed")).toBe("image__IQU__v2.fits-PI-profile-smoothed-2026-09-23-21-40-14");
    });

    test("trim the name before the timestamp to 200 characters", () => {
        const name = getExportFileName("a".repeat(300), "image");
        expect(name).toBe(`${"a".repeat(200)}-2026-09-23-21-40-14`);
    });

    test("are used for the TSV download", () => {
        let downloadName = "";
        jest.spyOn(HTMLAnchorElement.prototype, "dispatchEvent").mockImplementation(function (this: HTMLAnchorElement) {
            downloadName = this.download;
            return true;
        });
        exportTsvFile("image IQU.fits", "Q profile", "# x\ty\n");
        expect(downloadName).toBe("image__IQU.fits-Q-profile-2026-09-23-21-40-14.tsv");
    });
});
