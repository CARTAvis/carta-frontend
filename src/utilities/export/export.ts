import html2canvas from "html2canvas";
import moment from "moment";

export function GetTimestamp(format: string = "YYYY-MM-DD-HH-mm-ss") {
    return moment(new Date()).format(format);
}

export function GetUnixTimestamp() {
    return +moment(new Date());
}

export function ExportTsvFile(imageName: string, plotName: string, content: string) {
    const tsvData = `data:text/tab-separated-values;charset=utf-8,${content}\n`.trim();
    const dataURL = encodeURI(tsvData).replace(/#/g, "%23");

    const a = document.createElement("a") as HTMLAnchorElement;
    a.href = dataURL;

    a.download = `${imageName.replaceAll(" ", "__")}-${plotName.replaceAll(" ", "-")}-${GetTimestamp()}.tsv`;
    a.dispatchEvent(new MouseEvent("click"));

    return null;
}

export function ExportTxtFile(fileName: string, content: string) {
    const txtData = `data:text/plain;charset=utf-8,${content}\n`.trim();
    const dataURL = encodeURI(txtData).replace(/#/g, "%23");

    const a = document.createElement("a") as HTMLAnchorElement;
    a.href = dataURL;

    a.download = `${fileName.replaceAll(" ", "__")}.txt`;
    a.dispatchEvent(new MouseEvent("click"));

    return null;
}

export async function ExportScreenshot(isImageOnly = true, maxWidth = 512, format = "image/jpeg", quality = 0.85) {
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

export async function CopyToClipboard(value: string) {
    if (navigator.clipboard) {
        await navigator.clipboard.writeText(value);
    } else {
        const copyText = document.createElement("textarea");
        copyText.value = value;
        document.body.appendChild(copyText);
        copyText.focus();
        copyText.select();
        document.execCommand("copy");
        document.body.removeChild(copyText);
    }
}
