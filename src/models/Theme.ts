export class Theme {
    public static readonly LIGHT = "light";
    public static readonly DARK = "dark";

    public static isValid = (theme: string): boolean => {
        return theme && (theme === Theme.LIGHT || theme === Theme.DARK);
    };
}