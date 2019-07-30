export class PresetLayout {
    public static readonly DEFAULT = "Default";
    public static readonly CUBEVIEW = "Cube View";
    public static readonly CUBEANALYSIS = "Cube Analysis";
    public static readonly CONTINUUMANALYSIS = "Continuum Analysis";
    public static readonly PRESETS = [PresetLayout.DEFAULT, PresetLayout.CUBEVIEW, PresetLayout.CUBEANALYSIS, PresetLayout.CONTINUUMANALYSIS];

    public static isValid = (layout: string): boolean => {
        return layout && PresetLayout.PRESETS.includes(layout);
    };
}