export class RegionCreationMode {
    public static readonly CENTER = "center";
    public static readonly CORNER = "corner";

    public static IsValid = (regionCreationMode: string): boolean => {
        return regionCreationMode === RegionCreationMode.CENTER || regionCreationMode === RegionCreationMode.CORNER;
    };
}
