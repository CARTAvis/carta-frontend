export class RegionCreationMode {
    public static readonly CENTER = "center";
    public static readonly CORNER = "corner";

    public static isValid = (regionCreationMode: string): boolean => {
        return regionCreationMode && (regionCreationMode === RegionCreationMode.CENTER || regionCreationMode === RegionCreationMode.CORNER);
    };
}
