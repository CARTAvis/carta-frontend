export class Layout {
    public static readonly CUBEVIEW = "cube_view";
    public static readonly CUBEANALYSIS = "cube_analysis";
    public static readonly CONTINUUMANALYSIS = "continuum_analysis";

    public static isValid = (layout: string): boolean => {
        return layout && (layout === Layout.CUBEVIEW || layout === Layout.CUBEANALYSIS || layout === Layout.CONTINUUMANALYSIS) ? true : false;
    }
}