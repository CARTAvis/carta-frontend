import {Classes} from "@blueprintjs/core";
import html2canvas from "html2canvas-pro";
import moment from "moment";

export function getTimestamp(format: string = "YYYY-MM-DD-HH-mm-ss") {
    return moment(new Date()).format(format);
}

export function getUnixTimestamp() {
    return +moment(new Date());
}

// Longer file names can make browsers refuse the download
const MAX_EXPORT_NAME_LENGTH = 200;

export function getExportFileName(imageName: string, content: string): string {
    const name = `${imageName.replaceAll(" ", "__")}-${content.replaceAll(" ", "-")}`.substring(0, MAX_EXPORT_NAME_LENGTH);
    return `${name}-${getTimestamp()}`;
}

export function exportTsvFile(imageName: string, plotName: string, content: string) {
    const tsvData = `data:text/tab-separated-values;charset=utf-8,${content}\n`.trim();
    const dataURL = encodeURI(tsvData).replace(/#/g, "%23");

    const a = document.createElement("a") as HTMLAnchorElement;
    a.href = dataURL;

    a.download = `${getExportFileName(imageName, plotName)}.tsv`;
    a.dispatchEvent(new MouseEvent("click"));

    return null;
}

export function exportTxtFile(fileName: string, content: string) {
    const txtData = `data:text/plain;charset=utf-8,${content}\n`.trim();
    const dataURL = encodeURI(txtData).replace(/#/g, "%23");

    const a = document.createElement("a") as HTMLAnchorElement;
    a.href = dataURL;

    a.download = `${fileName.replaceAll(" ", "__")}.txt`;
    a.dispatchEvent(new MouseEvent("click"));

    return null;
}

/** The classes of overlays that a screenshot of the app leaves out, such as dialogs, toasts and popovers. */
const SCREENSHOT_IGNORED_CLASSES = [Classes.PORTAL, Classes.OVERLAY, Classes.TOAST_CONTAINER, Classes.POPOVER];

/**
 * Takes a screenshot of the image viewer, or of the whole app.
 *
 * A screenshot of the whole app shows the docked layout and the floating widgets, as the user sees
 * them. It leaves out every overlay, because the Save dialog is still open when a workspace saves
 * its thumbnail.
 */
export async function exportScreenshot(isImageOnly = true, maxWidth = 512, format = "image/jpeg", quality = 0.85) {
    try {
        const element = (isImageOnly ? document.getElementsByClassName("image-view-div")?.[0] : document.getElementsByClassName("App")?.[0]) as HTMLElement;
        if (!element) {
            return false;
        }

        const canvas = await html2canvas(element, isImageOnly ? undefined : {ignoreElements: node => SCREENSHOT_IGNORED_CLASSES.some(className => node.classList?.contains(className))});
        const thumbnailCanvas: HTMLCanvasElement = document.createElement("canvas");
        let width: number;
        let height: number;
        if (maxWidth <= 0) {
            width = canvas.width;
            height = canvas.height;
        } else {
            width = maxWidth;
            height = maxWidth * (canvas.height / canvas.width);
        }
        thumbnailCanvas.width = width;
        thumbnailCanvas.height = height;
        const ctx = thumbnailCanvas.getContext("2d");
        ctx?.drawImage(canvas, 0, 0, width, height);
        return thumbnailCanvas.toDataURL(format, quality);
    } catch (err) {
        console.error(err);
    }
    return undefined;
}

export async function copyToClipboard(value: string) {
    if (!navigator.clipboard?.writeText) {
        return false;
    }
    await navigator.clipboard.writeText(value);
    return true;
}
