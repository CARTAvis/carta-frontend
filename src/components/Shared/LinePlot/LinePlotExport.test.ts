import {PlotType} from "enums";
import * as exportUtilities from "utilities/export/export";

import "stores";

import {LinePlotComponent, type LinePlotComponentProps} from "./LinePlotComponent";

describe("LinePlotComponent TSV export header", () => {
    const exportedFiles = (props: Partial<LinePlotComponentProps>) => {
        const exportTsvFile = rs.spyOn(exportUtilities, "exportTsvFile").mockReturnValue(null);
        new LinePlotComponent({xLabel: "Channel", yLabel: "Value", ...props} as LinePlotComponentProps).exportData();
        const files = exportTsvFile.mock.calls.map(([imageName, plotName, content]) => ({imageName, plotName, firstLine: content.split("\n")[0], content}));
        exportTsvFile.mockRestore();
        return files;
    };

    test("uses the export title after the image name when one is given", () => {
        const [file] = exportedFiles({data: [{x: 0, y: 1}], imageName: "image_IQU.fits", plotName: "PI-profile", exportTitle: "PI profile"});
        expect(file).toEqual(expect.objectContaining({imageName: "image_IQU.fits", plotName: "PI-profile", firstLine: "# image_IQU.fits PI profile"}));
    });

    test("uses the export title of a line in a multi-line plot", () => {
        const multiPlotPropsMap = new Map([["Qz", {imageName: "image_IQU.fits", plotName: "Q-profile", exportTitle: "Q profile", data: [{x: 0, y: 1}], type: PlotType.STEPS}]]);
        const [file] = exportedFiles({imageName: "image_IQU.fits", plotName: "quLine", multiPlotPropsMap});
        expect(file).toEqual(expect.objectContaining({imageName: "image_IQU.fits", plotName: "Q-profile", firstLine: "# image_IQU.fits Q profile"}));
        expect(file.content).not.toContain("# Qz");
    });

    test("puts the image name first for plots without an export title", () => {
        const [single] = exportedFiles({data: [{x: 0, y: 1}], imageName: "cube.fits", plotName: "histogram"});
        expect(single.firstLine).toBe("# cube.fits histogram");
        const multiPlotPropsMap = new Map([["profile0", {imageName: "cube.fits", plotName: "Z-profile", data: [{x: 0, y: 1}], type: PlotType.STEPS}]]);
        const [multi] = exportedFiles({imageName: "cube.fits", plotName: "zProfile", multiPlotPropsMap});
        expect(multi.firstLine).toBe("# cube.fits Z-profile");
    });
});
