import moment from "moment";

export function getTimestamp(format: string = "YYYY-MM-DD-HH-mm-ss") {
    return moment(new Date()).format(format);
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

export function exportTxtFile(imageName: string, content: string){
    const TxtData = `data:text/tab-separated-values;charset=utf-8,${content}\n`;

    const a = document.createElement("a") as HTMLAnchorElement;
    a.href = TxtData;

    a.download = `${imageName}-header.txt`;
    a.dispatchEvent(new MouseEvent("click"));

    return null;
}