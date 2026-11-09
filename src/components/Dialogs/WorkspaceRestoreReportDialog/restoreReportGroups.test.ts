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
    causeImageId: 3
};

function widgetIssue(widgetId: string, effect: WorkspaceIssueEffect, causeImageId?: number): WorkspaceIssue {
    const reason = effect === WorkspaceIssueEffect.ActiveImage ? "the image it showed was not restored, so it shows the active image" : "the region it showed was not restored, so it shows the active region";
    return {kind: WorkspaceItemKind.PlotWidget, subject: widgetId, message: `Could not fully restore the widget ${widgetId}: ${reason}`, reason, effect, causeImageId};
}

describe("grouping the restore report", () => {
    test("lists what a left-out item caused under it, also along a chain of causes", () => {
        const issues = [SKIPPED_IMAGE, SKIPPED_MOMENTS, CATALOG_ON_MOMENT, widgetIssue("spatial-profiler-0", WorkspaceIssueEffect.ActiveImage, 2), widgetIssue("stats-0", WorkspaceIssueEffect.ActiveImage, 1)];

        const groups = groupRestoreReport(issues);

        expect(groups.leftOut).toEqual([
            {
                issue: SKIPPED_IMAGE,
                leftOut: [SKIPPED_MOMENTS, CATALOG_ON_MOMENT],
                widgets: [{effect: WorkspaceIssueEffect.ActiveImage, widgetIds: ["spatial-profiler-0", "stats-0"]}],
                changed: []
            }
        ]);
        expect(groups.leftOutCount).toBe(3);
        expect(groups.changed).toEqual([]);
        expect(groups.changedCount).toBe(0);
    });

    test("lists a catalog widget under the image whose catalog it showed, through the catalog", () => {
        const catalog: WorkspaceIssue = {...CATALOG_ON_MOMENT, causeImageId: 1, catalogIds: [4]};
        const table: WorkspaceIssue = {
            kind: WorkspaceItemKind.CatalogWidget,
            subject: "catalog-overlay-0",
            message: "Could not restore catalog widget catalog-overlay-0: the catalog sources.vot is unavailable",
            reason: "the catalog sources.vot is unavailable",
            causeCatalogId: 4,
            effect: WorkspaceIssueEffect.CatalogNotRestored
        };

        const groups = groupRestoreReport([SKIPPED_IMAGE, catalog, table]);

        expect(groups.leftOut).toEqual([{issue: SKIPPED_IMAGE, leftOut: [catalog], widgets: [{effect: WorkspaceIssueEffect.CatalogNotRestored, widgetIds: ["catalog-overlay-0"]}], changed: []}]);
        expect(groups.changedCount).toBe(0);
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
            {widgets: {effect: WorkspaceIssueEffect.ActiveImage, widgetIds: ["stats-0", "render-config-0"]}},
            {issue: plain},
            {widgets: {effect: WorkspaceIssueEffect.ActiveRegion, widgetIds: ["histogram-0", "stokes-0"]}}
        ]);
        expect(groups.changedCount).toBe(5);
    });

    test("keeps at the top level a left-out item whose cause is not reported", () => {
        const groups = groupRestoreReport([CATALOG_ON_MOMENT]);

        expect(groups.leftOut.map(item => item.issue)).toEqual([CATALOG_ON_MOMENT]);
        expect(groups.leftOutCount).toBe(1);
    });

    test("stops at a loop of causes", () => {
        const first: WorkspaceIssue = {...SKIPPED_MOMENTS, imageIds: [2], causeImageId: 3};
        const second: WorkspaceIssue = {...SKIPPED_MOMENTS, subject: "other", imageIds: [3], causeImageId: 2};

        const groups = groupRestoreReport([first, second]);

        expect(groups.leftOutCount).toBe(2);
        expect(groups.leftOut.length + groups.leftOut.reduce((count, item) => count + item.leftOut.length, 0)).toBe(2);
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

    test("shows the message of an issue without a name", () => {
        expect(describeIssue({kind: WorkspaceItemKind.Layout, subject: "", message: "Could not restore the layout"}, titleOfWidget)).toBe("Could not restore the layout");
    });

    test("says what a group of widgets shows, for one widget and for several", () => {
        expect(describeWidgetGroup({effect: WorkspaceIssueEffect.ActiveImage, widgetIds: ["a"]}, true)).toBe("Widget that now shows the active image:");
        expect(describeWidgetGroup({effect: WorkspaceIssueEffect.ActiveImage, widgetIds: ["a", "b"]}, true)).toBe("Widgets that now show the active image:");
        expect(describeWidgetGroup({effect: WorkspaceIssueEffect.ActiveImage, widgetIds: ["a", "b"]}, false)).toBe("Widgets that show the active image, because the image they showed was not restored:");
        expect(describeWidgetGroup({effect: WorkspaceIssueEffect.ActiveRegion, widgetIds: ["a"]}, false)).toBe("Widget that shows the active region, because the region it showed was not restored:");
        expect(describeWidgetGroup({effect: WorkspaceIssueEffect.CatalogNotRestored, widgetIds: ["a", "b"]}, true)).toBe("Catalog widgets whose catalog was not restored:");
    });
});

describe("finding the file names in a report line", () => {
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
        expect(splitFileNames("The PV image of cube.fits.moment.maximum", "the PV image of cube.fits.moment.maximum")).toEqual([
            {text: "The PV image of ", isFile: false},
            {text: "cube.fits.moment.maximum", isFile: true}
        ]);
    });

    test("finds nothing in a line without file names", () => {
        expect(splitFileNames("The catalog from the SIMBAD query", "from the SIMBAD query")).toEqual([{text: "The catalog from the SIMBAD query", isFile: false}]);
    });
});
