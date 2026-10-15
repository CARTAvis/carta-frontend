import html2canvas from "html2canvas";
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

export async function exportScreenshot(isImageOnly = true, maxWidth = 512, format = "image/jpeg", quality = 0.85) {
    try {
        // Screenshot of
        const element = (isImageOnly ? document.getElementsByClassName("image-view-div")?.[0] : document.body) as HTMLElement;
        if (!element) {
            return false;
        }

        const canvas = await html2canvas(element);
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
