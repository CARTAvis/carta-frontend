import {WorkspaceIssueEffect, WorkspaceIssueOutcome, WorkspaceItemKind} from "enums";
import {type WorkspaceIssue} from "models";

import {describeIssue, describeWidgetGroup, groupRestoreReport, splitFileNames} from "./restoreReportGroups";

const SKIPPED_IMAGE: WorkspaceIssue = {
    kind: WorkspaceItemKind.Image,
    subject: "cube.fits",
    message: "Could not open the image cube.fits",
    outcome: WorkspaceIssueOutcome.Skipped,
    label: "The image cube.fits",
    imageIds: [1]
};
const SKIPPED_MOMENTS: WorkspaceIssue = {
    kind: WorkspaceItemKind.GeneratedImage,
    subject: "the moment images of cube.fits",
    message: "Skipped making the moment images of cube.fits: the image it is made from was skipped",
    outcome: WorkspaceIssueOutcome.Skipped,
    label: "The moment images of cube.fits",
    reason: "the image it is made from was skipped",
    imageIds: [2, 3],
    causeImageId: 1
};
const CATALOG_ON_MOMENT: WorkspaceIssue = {
    kind: WorkspaceItemKind.Catalog,
    subject: "sources.vot",
    message: "Skipped the catalog sources.vot: the image it belongs to was skipped",
    outcome: WorkspaceIssueOutcome.Skipped,
    label: "The catalog sources.vot",
    reason: "the image it belongs to was skipped",
    causeImageId: 3,
    catalogIds: [4]
};

function widgetIssue(widgetId: string, effect: WorkspaceIssueEffect, causeImageId?: number): WorkspaceIssue {
    const reason = effect === WorkspaceIssueEffect.ActiveRegion ? "the region it showed was not restored, so it shows the active region" : "the image it showed was not restored, so it shows the active image";
    return {kind: WorkspaceItemKind.PlotWidget, subject: widgetId, message: `Could not fully restore the widget ${widgetId}: ${reason}`, reason, effect, causeImageId};
}

function catalogWidgetIssue(widgetId: string, causeCatalogId: number, effectDetail?: string): WorkspaceIssue {
    const reason = `the catalog sources.vot is unavailable${effectDetail ? `; it is showing ${effectDetail} instead` : ""}`;
    return {kind: WorkspaceItemKind.CatalogWidget, subject: widgetId, message: `Could not restore catalog widget ${widgetId}: ${reason}`, reason, causeCatalogId, effect: WorkspaceIssueEffect.CatalogNotRestored, effectDetail};
}

describe("grouping the restore report", () => {
    test("lists what a left-out item caused under it, also along a chain of causes through images and catalogs", () => {
        const issues = [
            SKIPPED_IMAGE,
            SKIPPED_MOMENTS,
            CATALOG_ON_MOMENT,
            widgetIssue("spatial-profiler-0", WorkspaceIssueEffect.ActiveImage, 2),
            widgetIssue("stats-0", WorkspaceIssueEffect.ActiveImage, 1),
            catalogWidgetIssue("catalog-overlay-0", 4)
        ];

        const groups = groupRestoreReport(issues);

        expect(groups.leftOut).toEqual([
            {
                issue: SKIPPED_IMAGE,
                leftOut: [SKIPPED_MOMENTS, CATALOG_ON_MOMENT],
                widgets: [
                    {effect: WorkspaceIssueEffect.ActiveImage, detail: undefined, widgetIds: ["spatial-profiler-0", "stats-0"]},
                    {effect: WorkspaceIssueEffect.CatalogNotRestored, detail: undefined, widgetIds: ["catalog-overlay-0"]}
                ],
                changed: []
            }
        ]);
        expect(groups.changed).toEqual([]);
    });

    test("lists an issue without an effect under its cause as it is", () => {
        const profiler: WorkspaceIssue = {kind: WorkspaceItemKind.PlotWidget, subject: "spectral-profiler-0", message: "…", reason: "some of the images whose profiles it showed were not restored", causeImageId: 1};

        const groups = groupRestoreReport([SKIPPED_IMAGE, profiler]);

        expect(groups.leftOut[0].changed).toEqual([profiler]);
        expect(groups.changed).toEqual([]);
    });

    test("keeps apart catalog widgets that show different catalogs now", () => {
        const groups = groupRestoreReport([catalogWidgetIssue("catalog-overlay-0", 4, "the catalog other.vot"), catalogWidgetIssue("catalog-overlay-1", 4), catalogWidgetIssue("catalog-plot-0", 4, "the catalog other.vot")]);

        expect(groups.changed).toEqual([
            {widgets: {effect: WorkspaceIssueEffect.CatalogNotRestored, detail: "the catalog other.vot", widgetIds: ["catalog-overlay-0", "catalog-plot-0"]}},
            {widgets: {effect: WorkspaceIssueEffect.CatalogNotRestored, detail: undefined, widgetIds: ["catalog-overlay-1"]}}
        ]);
    });

    test("lists widgets whose cause is not a left-out item together by their effect, in the order of the report", () => {
        const plain: WorkspaceIssue = {kind: WorkspaceItemKind.Layout, subject: "", message: "Could not restore the layout the workspace was saved in"};
        const issues = [
            widgetIssue("stats-0", WorkspaceIssueEffect.ActiveImage, 7),
            plain,
            widgetIssue("histogram-0", WorkspaceIssueEffect.ActiveRegion),
            widgetIssue("render-config-0", WorkspaceIssueEffect.ActiveImage),
            widgetIssue("stokes-0", WorkspaceIssueEffect.ActiveRegion)
        ];

        const groups = groupRestoreReport(issues);

        expect(groups.leftOut).toEqual([]);
        expect(groups.changed).toEqual([
            {widgets: {effect: WorkspaceIssueEffect.ActiveImage, detail: undefined, widgetIds: ["stats-0", "render-config-0"]}},
            {issue: plain},
            {widgets: {effect: WorkspaceIssueEffect.ActiveRegion, detail: undefined, widgetIds: ["histogram-0", "stokes-0"]}}
        ]);
    });

    test("keeps at the top level a left-out item whose cause is not reported", () => {
        const groups = groupRestoreReport([CATALOG_ON_MOMENT]);

        expect(groups.leftOut.map(item => item.issue)).toEqual([CATALOG_ON_MOMENT]);
    });

    test("lists an issue under the first item that left its image out", () => {
        const other: WorkspaceIssue = {...SKIPPED_IMAGE, subject: "other.fits", label: "The image other.fits"};
        const widget = widgetIssue("stats-0", WorkspaceIssueEffect.ActiveImage, 1);

        const groups = groupRestoreReport([SKIPPED_IMAGE, other, widget]);

        expect(groups.leftOut.map(item => item.widgets.length)).toEqual([1, 0]);
    });

    test("keeps the items of a loop of causes at the top level, and lists a widget whose cause is in the loop once", () => {
        const first: WorkspaceIssue = {...SKIPPED_MOMENTS, imageIds: [2], causeImageId: 3};
        const second: WorkspaceIssue = {...SKIPPED_MOMENTS, subject: "other", imageIds: [3], causeImageId: 2};
        const widget = widgetIssue("stats-0", WorkspaceIssueEffect.ActiveImage, 2);

        const groups = groupRestoreReport([first, second, widget]);

        expect(groups.leftOut.map(item => item.issue)).toEqual([first, second]);
        expect(groups.leftOut.reduce((count, item) => count + item.widgets.length, 0) + groups.changed.length).toBe(1);
    });
});

describe("describing an issue in the restore report", () => {
    const titleOfWidget = (widgetId: string) => (widgetId === "spatial-profiler-0" ? "X Profile: Cursor" : widgetId);

    test("names the item and gives the reason, without the outcome", () => {
        expect(describeIssue(CATALOG_ON_MOMENT, titleOfWidget)).toBe("The catalog sources.vot: the image it belongs to was skipped");
        expect(describeIssue(SKIPPED_IMAGE, titleOfWidget)).toBe("The image cube.fits");
    });

    test("leaves out the reason of an item listed under its cause", () => {
        expect(describeIssue(CATALOG_ON_MOMENT, titleOfWidget, false)).toBe("The catalog sources.vot");
    });

    test("names a widget by its title", () => {
        expect(describeIssue(widgetIssue("spatial-profiler-0", WorkspaceIssueEffect.ActiveRegion), titleOfWidget)).toBe("X Profile: Cursor: the region it showed was not restored, so it shows the active region");
    });

    test("shows the message of an issue without a name, or of a widget without a reason", () => {
        expect(describeIssue({kind: WorkspaceItemKind.Layout, subject: "", message: "Could not restore the layout"}, titleOfWidget)).toBe("Could not restore the layout");
        expect(describeIssue({kind: WorkspaceItemKind.CatalogPlot, subject: "catalog-plot-0", message: "Could not restore catalog plot catalog-plot-0"}, titleOfWidget)).toBe("Could not restore catalog plot catalog-plot-0");
    });

    test("says what a group of widgets shows now, for one widget and for several", () => {
        expect(describeWidgetGroup({effect: WorkspaceIssueEffect.ActiveImage, widgetIds: ["a"]}, true)).toBe("Widget that showed it now shows the active image:");
        expect(describeWidgetGroup({effect: WorkspaceIssueEffect.ActiveImage, widgetIds: ["a", "b"]}, true)).toBe("Widgets that showed it now show the active image:");
        expect(describeWidgetGroup({effect: WorkspaceIssueEffect.ActiveImage, widgetIds: ["a", "b"]}, false)).toBe("Widgets whose image was not restored, now showing the active image:");
        expect(describeWidgetGroup({effect: WorkspaceIssueEffect.ActiveImageFollowed, widgetIds: ["a"]}, true)).toBe("Widget that followed it as the active image now shows another image:");
        expect(describeWidgetGroup({effect: WorkspaceIssueEffect.ActiveImageFollowed, widgetIds: ["a", "b"]}, false)).toBe("Widgets that follow the active image, which is not the image that was in front:");
        expect(describeWidgetGroup({effect: WorkspaceIssueEffect.ActiveRegion, widgetIds: ["a"]}, false)).toBe("Widget whose region was not restored, now showing the active region:");
        expect(describeWidgetGroup({effect: WorkspaceIssueEffect.CatalogNotRestored, widgetIds: ["a", "b"]}, true)).toBe("Catalog widgets whose catalog was not restored, now showing no catalog:");
        expect(describeWidgetGroup({effect: WorkspaceIssueEffect.CatalogNotRestored, detail: "the catalog other.vot", widgetIds: ["a"]}, false)).toBe("Catalog widget whose catalog was not restored, now showing the catalog other.vot:");
    });
});

describe("finding the file names in a report line", () => {
    const files = (text: string, subject: string, label?: string) => splitFileNames(text, subject, label).flatMap(part => (part.isFile ? [part.text] : []));

    test("finds the file names of the subject and the absolute paths", () => {
        expect(splitFileNames("The image cube.fits: File /data/cube.fits does not exist", "cube.fits")).toEqual([
            {text: "The image ", isFile: false},
            {text: "cube.fits", isFile: true},
            {text: ": File ", isFile: false},
            {text: "/data/cube.fits", isFile: true},
            {text: " does not exist", isFile: false}
        ]);
    });

    test("finds a file name inside the subject of a request, and the longest name first", () => {
        expect(files("The PV image of cube.fits.moment.maximum", "the PV image of cube.fits.moment.maximum")).toEqual(["cube.fits.moment.maximum"]);
    });

    test("finds a file name in the label, and the host of a mirror in the reason", () => {
        expect(files("The SIMBAD catalog on cube.fits: Mirror simbad.u-strasbg.fr did not respond", "from the SIMBAD query", "The SIMBAD catalog on cube.fits")).toEqual(["cube.fits", "simbad.u-strasbg.fr"]);
        expect(files("Request to mirror vizier.cds.unistra.fr failed.", "from the VizieR query")).toEqual(["vizier.cds.unistra.fr"]);
    });

    test("finds a file name with a space when it is the whole subject", () => {
        expect(files("The image my cube.fits", "my cube.fits")).toEqual(["my cube.fits"]);
    });

    test("leaves out the period after a path", () => {
        expect(files("File /data/cube.fits.", "cube.fits")).toEqual(["/data/cube.fits"]);
    });

    test("finds a whole URL, and no file name in a version or a line without file names", () => {
        expect(files("The HiPS image of https://alasky.cds.unistra.fr/DSS/DSS2.", "the HiPS image of https://alasky.cds.unistra.fr/DSS/DSS2")).toEqual(["https://alasky.cds.unistra.fr/DSS/DSS2"]);
        expect(files("The image v1.2 of cube", "v1.2")).toEqual([]);
        expect(files("The catalog from the SIMBAD query", "from the SIMBAD query")).toEqual([]);
    });
});
