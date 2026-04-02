export class CursorPosition {
    public static readonly FIXED = "fixed";
    public static readonly TRACKING = "tracking";

    public static IsValid = (cursorPosition: string): boolean => {
        return cursorPosition === CursorPosition.FIXED || cursorPosition === CursorPosition.TRACKING;
    };
}
