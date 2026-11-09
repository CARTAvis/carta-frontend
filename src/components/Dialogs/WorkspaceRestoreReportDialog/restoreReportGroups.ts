import {WorkspaceIssueEffect, WorkspaceItemKind} from "enums";
import {type WorkspaceIssue} from "models";

/** Widgets that show something else than they showed, for the same reason. */
export interface WidgetGroup {
    effect: WorkspaceIssueEffect;
    /** The stable IDs of the widgets, in the order of the report. */
    widgetIds: string[];
}

/** An item that the restore left out, with what it left out or changed in turn. */
export interface LeftOutItem {
    issue: WorkspaceIssue;
    /** The items that are not in the session because of this item, such as the catalogs of a skipped image. */
    leftOut: WorkspaceIssue[];
    /** The widgets that show something else because of this item. */
    widgets: WidgetGroup[];
    /** The other items that are not as saved because of this item. */
    changed: WorkspaceIssue[];
}

/** An item that is in the session but not as saved: a single issue, or widgets with the same effect. */
export type ChangedItem = {issue: WorkspaceIssue} | {widgets: WidgetGroup};

export interface RestoreReportGroups {
    leftOut: LeftOutItem[];
    /** The number of items that the restore left out, also the ones listed under another item. */
    leftOutCount: number;
    changed: ChangedItem[];
    /** The number of items in the session that are not as saved and that no left-out item explains. */
    changedCount: number;
}

function addToGroups(groups: WidgetGroup[], effect: WorkspaceIssueEffect, widgetId: string): WidgetGroup | undefined {
    const group = groups.find(existing => existing.effect === effect);
    if (group) {
        group.widgetIds.push(widgetId);
        return undefined;
    }
    const created = {effect, widgetIds: [widgetId]};
    groups.push(created);
    return created;
}

/**
 * Groups the issues of a restore for the report.
 *
 * Lists each issue under the left-out item that caused it. For example, the catalogs of a skipped
 * image and the widgets that showed the image are listed under the image. The cause is found by the
 * saved images: an issue names the image that caused it in `causeImageId`, and a left-out item names
 * the images that it left out in `imageIds`. A chain of causes is listed under its first item.
 *
 * Widgets with the same effect are listed together, both under an item and in the changed items.
 */
export function groupRestoreReport(issues: readonly WorkspaceIssue[]): RestoreReportGroups {
    const leftOutIssues = issues.filter(issue => issue.outcome);
    const ownerOfImage = new Map<number, WorkspaceIssue>();
    for (const issue of leftOutIssues) {
        for (const imageId of issue.imageIds ?? []) {
            if (!ownerOfImage.has(imageId)) {
                ownerOfImage.set(imageId, issue);
            }
        }
    }

    // Follow the causes up to the first item, which is listed at the top level. An item in a loop
    // of causes stays at the top level, so that the report still lists it.
    const rootOf = (issue: WorkspaceIssue): WorkspaceIssue => {
        const seen = new Set<WorkspaceIssue>([issue]);
        let current = issue;
        while (current.causeImageId !== undefined) {
            const owner = ownerOfImage.get(current.causeImageId);
            if (!owner) {
                break;
            }
            if (seen.has(owner)) {
                return issue;
            }
            seen.add(owner);
            current = owner;
        }
        return current;
    };

    const items = new Map<WorkspaceIssue, LeftOutItem>();
    const leftOut: LeftOutItem[] = [];
    for (const issue of leftOutIssues) {
        if (rootOf(issue) === issue) {
            const item = {issue, leftOut: [], widgets: [], changed: []};
            items.set(issue, item);
            leftOut.push(item);
        }
    }

    const changed: ChangedItem[] = [];
    const changedGroups: WidgetGroup[] = [];
    let changedCount = 0;
    for (const issue of issues) {
        const root = rootOf(issue);
        const item = root === issue ? undefined : items.get(root);
        if (item) {
            if (issue.outcome) {
                item.leftOut.push(issue);
            } else if (issue.effect) {
                addToGroups(item.widgets, issue.effect, issue.subject);
            } else {
                item.changed.push(issue);
            }
        } else if (!issue.outcome) {
            changedCount++;
            if (issue.effect) {
                const group = addToGroups(changedGroups, issue.effect, issue.subject);
                if (group) {
                    changed.push({widgets: group});
                }
            } else {
                changed.push({issue});
            }
        }
    }
    return {leftOut, leftOutCount: leftOutIssues.length, changed, changedCount};
}

/**
 * Returns how the report shows an issue: the name of the item and the reason, such as "The image
 * cube.fits: File does not exist". A widget is named by its title. An issue without a name shows its
 * message.
 *
 * @param titleOfWidget - returns the title that a widget shows, by its stable ID.
 * @param shouldShowReason - whether to add the reason. An item listed under its cause does not need it.
 */
export function describeIssue(issue: WorkspaceIssue, titleOfWidget: (widgetId: string) => string, shouldShowReason: boolean = true): string {
    const name = issue.kind === WorkspaceItemKind.PlotWidget && issue.reason !== undefined ? titleOfWidget(issue.subject) : issue.label;
    if (!name) {
        return issue.message;
    }
    return shouldShowReason && issue.reason ? `${name}: ${issue.reason}` : name;
}

/**
 * Returns the text before the titles of a group of widgets.
 *
 * @param isUnderCause - whether the group is listed under the item that caused it, which already says why.
 */
export function describeWidgetGroup(group: WidgetGroup, isUnderCause: boolean): string {
    const count = group.widgetIds.length;
    const widgets = count === 1 ? "Widget" : "Widgets";
    if (group.effect === WorkspaceIssueEffect.ActiveImage) {
        return isUnderCause
            ? `${widgets} that now show${count === 1 ? "s" : ""} the active image:`
            : `${widgets} that show${count === 1 ? "s" : ""} the active image, because the image ${count === 1 ? "it" : "they"} showed was not restored:`;
    }
    return `${widgets} that show${count === 1 ? "s" : ""} the active region, because the region ${count === 1 ? "it" : "they"} showed was not restored:`;
}
