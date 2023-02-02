export class Zoom {
    public static readonly FIT = "fit";
    public static readonly FULL = "full";

    public static isValid = (zoomMode: string): boolean => {
        return zoomMode && (zoomMode === Zoom.FIT || zoomMode === Zoom.FULL);
    };
}
