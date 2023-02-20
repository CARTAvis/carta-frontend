import html2canvas from "html2canvas";
import moment from "moment";

export function getTimestamp(format: string = "YYYY-MM-DD-HH-mm-ss") {
    return moment(new Date()).format(format);
}

export function getUnixTimestamp() {
    return +moment(new Date());
}

export function exportTsvFile(imageName: string, plotName: string, content: string) {
    const tsvData = `data:text/tab-separated-values;charset=utf-8,${content}\n`;
    const dataURL = encodeURI(tsvData).replace(/#/g, "%23");

    const a = document.createElement("a") as HTMLAnchorElement;
    a.href = dataURL;

    a.download = `${imageName}-${plotName.replace(" ", "-")}-${getTimestamp()}.tsv`;
    a.dispatchEvent(new MouseEvent("click"));

    return null;
}

export function exportTxtFile(fileName: string, content: string) {
    const txtData = `data:text/plain;charset=utf-8,${content}\n`;
    const dataURL = encodeURI(txtData).replace(/#/g, "%23");

    const a = document.createElement("a") as HTMLAnchorElement;
    a.href = dataURL;

    a.download = `${fileName}.txt`;
    a.dispatchEvent(new MouseEvent("click"));

    return null;
}

export async function exportScreenshot(maxWidth = 512, format = "image/jpeg", quality = 0.85) {
    try {
        const canvas = await html2canvas(document.body, {
            allowTaint: true,
            foreignObjectRendering: true,
            ignoreElements: el => {
                // Dont' render out file browser or workspace dialogs
                const className = el?.className;
                if (typeof className === "string") {
                    return className.includes("workspace-dialog") || className.includes("file-browser-dialog");
                }
                return false;
            }
        });

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
        ctx.drawImage(canvas, 0, 0, width, height);
        return thumbnailCanvas.toDataURL(format, quality);
    } catch (err) {
        console.log(err);
    }
    return undefined;
}
