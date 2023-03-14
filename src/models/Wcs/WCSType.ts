export class WCSType {
    public static readonly AUTOMATIC = "Automatic";
    public static readonly DEGREES = "Degrees";
    public static readonly SEXAGESIMAL = "Sexagesimal";

    public static isValid = (wcsType: string): boolean => {
        return wcsType && (wcsType === WCSType.AUTOMATIC || wcsType === WCSType.DEGREES || wcsType === WCSType.SEXAGESIMAL);
    };
}
