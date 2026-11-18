import {Classes} from "@blueprintjs/core";
import html2canvas from "html2canvas-pro";
import moment from "moment";

import {WORKSPACE_DIALOGS} from "enums";

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
 * Returns whether a screenshot of the whole app leaves out an element. The screenshot keeps the
 * dialogs that a workspace keeps open, such as the Contour dialog and the Preferences dialog. Then
 * the thumbnail of a workspace shows what a restore opens. It leaves out the other dialogs, such as
 * the Save dialog, and the other overlays, such as toasts and popovers.
 */
function isLeftOutOfScreenshot(node: Element): boolean {
    const dialogId = node.getAttribute?.("data-dialog-id");
    if (dialogId) {
        return !WORKSPACE_DIALOGS.includes(dialogId);
    }
    if (node.classList?.contains(Classes.POPOVER) || node.classList?.contains(Classes.TOAST_CONTAINER)) {
        return true;
    }
    // The overlay of a dialog that the screenshot keeps holds the dialog itself.
    return SCREENSHOT_IGNORED_CLASSES.some(className => node.classList?.contains(className)) && !node.closest?.("[data-dialog-id]");
}

/**
 * Takes a screenshot of the image viewer, or of the whole app.
 *
 * A screenshot of the whole app shows the docked layout, the floating widgets and the open analysis
 * dialogs, as the user sees them. It leaves out the other overlays, because the Save dialog is still
 * open when a workspace saves its thumbnail.
 */
export async function exportScreenshot(isImageOnly = true, maxWidth = 512, format = "image/jpeg", quality = 0.85) {
    try {
        const element = (isImageOnly ? document.getElementsByClassName("image-view-div")?.[0] : document.getElementsByClassName("App")?.[0]) as HTMLElement;
        if (!element) {
            return false;
        }

        // Draw the page at the width of the screenshot, not at the pixel ratio of the screen. On a
        // large screen with a high pixel ratio, the full size can be larger than the largest canvas
        // that Safari can make. Then the screenshot would fail.
        const scale = maxWidth > 0 && element.clientWidth > 0 ? Math.min(window.devicePixelRatio, maxWidth / element.clientWidth) : undefined;
        const ignoreElements = isImageOnly ? undefined : isLeftOutOfScreenshot;
        const canvas = await html2canvas(element, {scale, ignoreElements});
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
