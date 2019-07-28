export class PresetLayout {
    public static readonly DEFAULT = "Default";
    public static readonly CUBEVIEW = "Cube View";
    public static readonly CUBEANALYSIS = "Cube Analysis";
    public static readonly CONTINUUMANALYSIS = "Continuum Analysis";

    public static isValid = (layout: string): boolean => {
        return layout && (layout === PresetLayout.DEFAULT || layout === PresetLayout.CUBEVIEW || layout === PresetLayout.CUBEANALYSIS || layout === PresetLayout.CONTINUUMANALYSIS);
    };

    public static include = (layout: string): boolean => {
        return [PresetLayout.DEFAULT, PresetLayout.CUBEVIEW, PresetLayout.CUBEANALYSIS, PresetLayout.CONTINUUMANALYSIS].includes(layout);
    };

    public static getPresetLayouts = (): string[] => {
        return [PresetLayout.DEFAULT, PresetLayout.CUBEVIEW, PresetLayout.CUBEANALYSIS, PresetLayout.CONTINUUMANALYSIS];
    };
}