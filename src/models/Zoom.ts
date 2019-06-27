export class Zoom {
    public static readonly FIT = "fit";
    public static readonly RAW = "1.0x";

    public static isValid = (zoomMode: string): boolean => {
        return zoomMode && (zoomMode === Zoom.FIT || zoomMode === Zoom.RAW) ? true : false;
    };
}