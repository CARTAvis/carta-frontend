export class CursorPosition {
    public static readonly FIXED = "fixed";
    public static readonly TRACKING = "tracking";

    public static isValid = (cursorPosition: string): boolean => {
        return cursorPosition && (cursorPosition === CursorPosition.FIXED || cursorPosition === CursorPosition.TRACKING);
    };
}
