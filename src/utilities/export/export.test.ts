import {Classes} from "@blueprintjs/core";
import html2canvas from "html2canvas-pro";

import {exportScreenshot, exportTsvFile, getExportFileName} from "./export";

jest.mock("html2canvas-pro", () => jest.fn());

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

describe("exportScreenshot", () => {
    const captured = document.createElement("canvas");
    captured.width = 1024;
    captured.height = 512;

    beforeEach(() => {
        document.body.innerHTML = '<div class="App"><div class="image-view-div"></div></div>';
        (html2canvas as unknown as jest.Mock).mockResolvedValue(captured);
        jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({drawImage: jest.fn()} as never);
        jest.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,");
    });

    afterEach(() => {
        jest.restoreAllMocks();
        (html2canvas as unknown as jest.Mock).mockReset();
    });

    test("captures only the image viewer by default", async () => {
        await exportScreenshot();

        expect(html2canvas).toHaveBeenCalledWith(document.querySelector(".image-view-div"), expect.objectContaining({ignoreElements: undefined}));
    });

    test("captures the whole app without its overlays, such as dialogs, toasts and popovers", async () => {
        await exportScreenshot(false);

        const [element, options] = (html2canvas as unknown as jest.Mock).mock.calls[0];
        expect(element).toBe(document.querySelector(".App"));
        const ignores = (className: string) => {
            const node = document.createElement("div");
            node.classList.add(className);
            return options.ignoreElements(node);
        };
        expect([Classes.PORTAL, Classes.OVERLAY, Classes.TOAST_CONTAINER, Classes.POPOVER].map(ignores)).toEqual([true, true, true, true]);
        expect(ignores("floating-widget")).toBe(false);
    });

    test("draws the page at the width of the screenshot, and not larger than the pixel ratio of the screen", async () => {
        const app = document.querySelector(".App") as HTMLElement;
        jest.spyOn(app, "clientWidth", "get").mockReturnValue(3840);
        const pixelRatio = window.devicePixelRatio;
        window.devicePixelRatio = 2;
        await exportScreenshot(false, 1024);
        expect((html2canvas as unknown as jest.Mock).mock.calls[0][1].scale).toBeCloseTo(1024 / 3840);

        jest.spyOn(app, "clientWidth", "get").mockReturnValue(400);
        await exportScreenshot(false, 1024);
        expect((html2canvas as unknown as jest.Mock).mock.calls[1][1].scale).toBe(2);
        window.devicePixelRatio = pixelRatio;
    });

    test("scales the screenshot to the width asked for, keeping its aspect ratio", async () => {
        const thumbnail = await exportScreenshot(false, 512);

        expect(thumbnail).toBe("data:image/jpeg;base64,");
        expect((HTMLCanvasElement.prototype.toDataURL as jest.Mock).mock.instances[0]).toMatchObject({width: 512, height: 256});
    });
});
