export class ZoomPoint {
    public static readonly CURSOR = "cursor";
    public static readonly CENTER = "center";

    public static isValid = (zoomPoint: string): boolean => {
        return zoomPoint && (zoomPoint === ZoomPoint.CURSOR || zoomPoint === ZoomPoint.CENTER);
    };
}
