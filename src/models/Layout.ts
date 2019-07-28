export class Layout {
    public static readonly DEFAULT = "Default";
    public static readonly CUBEVIEW = "Cube View";
    public static readonly CUBEANALYSIS = "Cube Analysis";
    public static readonly CONTINUUMANALYSIS = "Continuum Analysis";

    public static isValid = (layout: string): boolean => {
        return layout && (layout === Layout.DEFAULT || layout === Layout.CUBEVIEW || layout === Layout.CUBEANALYSIS || layout === Layout.CONTINUUMANALYSIS);
    };

    public static getPresetLayouts = (): string[] => {
        return [Layout.DEFAULT, Layout.CUBEVIEW, Layout.CUBEANALYSIS, Layout.CONTINUUMANALYSIS];
    };
}