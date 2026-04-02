export class Zoom {
    public static readonly FIT = "fit";
    public static readonly FULL = "full";

    public static IsValid = (zoomMode: string): boolean => {
        return zoomMode === Zoom.FIT || zoomMode === Zoom.FULL;
    };
}
