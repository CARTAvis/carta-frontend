import {WorkspaceIssueEffect, WorkspaceItemKind} from "enums";
import {type WorkspaceIssue} from "models";

/** Widgets that show something else than they showed, for the same reason. */
export interface WidgetGroup {
    effect: WorkspaceIssueEffect;
    /** What the widgets show now, when it is not the same for every widget with the effect. See {@link WorkspaceIssue.effectDetail}. */
    detail?: string;
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
    changed: ChangedItem[];
}

/** Adds the widget of an issue to the group with its effect and detail, and returns the group when it is new. */
function addToGroups(groups: WidgetGroup[], issue: WorkspaceIssue & {effect: WorkspaceIssueEffect}): WidgetGroup | undefined {
    const group = groups.find(existing => existing.effect === issue.effect && existing.detail === issue.effectDetail);
    if (group) {
        group.widgetIds.push(issue.subject);
        return undefined;
    }
    const created = {effect: issue.effect, detail: issue.effectDetail, widgetIds: [issue.subject]};
    groups.push(created);
    return created;
}

/**
 * Groups the issues of a restore for the report.
 *
 * Lists each issue under the left-out item that caused it. For example, the catalogs of a skipped
 * image and the widgets that showed the image are listed under the image. The cause is found by the
 * saved images and catalogs: an issue names the image or catalog that caused it in `causeImageId` or
 * `causeCatalogId`, and a left-out item names the images and catalogs that it left out in `imageIds`
 * and `catalogIds`. A chain of causes is listed under its first item.
 *
 * Widgets with the same effect and detail are listed together, both under an item and in the
 * changed items.
 */
export function groupRestoreReport(issues: readonly WorkspaceIssue[]): RestoreReportGroups {
    const leftOutIssues = issues.filter(issue => issue.outcome);
    // The left-out item of each saved image and catalog, by keys such as "image 2" and "catalog 1".
    const owners = new Map<string, WorkspaceIssue>();
    for (const issue of leftOutIssues) {
        for (const key of [...(issue.imageIds ?? []).map(id => `image ${id}`), ...(issue.catalogIds ?? []).map(id => `catalog ${id}`)]) {
            if (!owners.has(key)) {
                owners.set(key, issue);
            }
        }
    }
    const ownerOf = (issue: WorkspaceIssue): WorkspaceIssue | undefined =>
        (issue.causeImageId !== undefined ? owners.get(`image ${issue.causeImageId}`) : undefined) ?? (issue.causeCatalogId !== undefined ? owners.get(`catalog ${issue.causeCatalogId}`) : undefined);

    // Follow the causes up to the first item, which is listed at the top level. An item in a loop
    // of causes stays at the top level, so that the report still lists it.
    const rootOf = (issue: WorkspaceIssue): WorkspaceIssue => {
        const seen = new Set<WorkspaceIssue>([issue]);
        let current = issue;
        for (;;) {
            const owner = ownerOf(current);
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
    for (const issue of issues) {
        const root = rootOf(issue);
        const item = root === issue ? undefined : items.get(root);
        const effect = issue.effect;
        if (item) {
            if (issue.outcome) {
                item.leftOut.push(issue);
            } else if (effect) {
                addToGroups(item.widgets, {...issue, effect});
            } else {
                item.changed.push(issue);
            }
        } else if (!issue.outcome) {
            if (effect) {
                const group = addToGroups(changedGroups, {...issue, effect});
                if (group) {
                    changed.push({widgets: group});
                }
            } else {
                changed.push({issue});
            }
        }
    }
    return {leftOut, changed};
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
    const isWidget = issue.kind === WorkspaceItemKind.PlotWidget || issue.kind === WorkspaceItemKind.CatalogWidget || issue.kind === WorkspaceItemKind.CatalogPlot;
    const name = isWidget ? titleOfWidget(issue.subject) : issue.label;
    if (!name || (isWidget && issue.reason === undefined)) {
        return issue.message;
    }
    return shouldShowReason && issue.reason ? `${name}: ${issue.reason}` : name;
}

/**
 * Returns the text before the titles of a group of widgets, which says what the widgets show now.
 *
 * @param isUnderCause - whether the group is listed under the item that caused it. Then "it" names that item.
 */
export function describeWidgetGroup(group: WidgetGroup, isUnderCause: boolean): string {
    const isOne = group.widgetIds.length === 1;
    const widgets = isOne ? "Widget" : "Widgets";
    const verb = (singular: string, plural: string) => (isOne ? singular : plural);
    switch (group.effect) {
        case WorkspaceIssueEffect.ActiveImage:
            return isUnderCause ? `${widgets} that showed it now ${verb("shows", "show")} the active image:` : `${widgets} whose image was not restored, now showing the active image:`;
        case WorkspaceIssueEffect.ActiveImageFollowed:
            return isUnderCause ? `${widgets} that followed it as the active image now ${verb("shows", "show")} another image:` : `${widgets} that ${verb("follows", "follow")} the active image, which is not the image that was in front:`;
        case WorkspaceIssueEffect.ActiveRegion:
            return `${widgets} whose region was not restored, now showing the active region:`;
        case WorkspaceIssueEffect.CatalogNotRestored:
            return `${isOne ? "Catalog widget" : "Catalog widgets"} whose catalog was not restored, now showing ${group.detail ?? "no catalog"}:`;
    }
}

/** A piece of a report line, which is a file name or a path when `isFile` is set. */
export interface TextPart {
    text: string;
    isFile: boolean;
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Returns whether a word reads as a file name, such as "cube.fits", and not a URL or a version such as "v1.2". */
function isFileName(word: string): boolean {
    const extension = word.slice(word.lastIndexOf(".") + 1);
    return word.length > 2 && word.includes(".") && !word.includes("://") && /[a-z]/i.test(extension);
}

/**
 * Splits a report line into the file names and paths, and the rest, so that the report can show the
 * file names in another style.
 *
 * Finds the file names of the item in its subject: the whole subject when it is a file name, such as
 * "my cube.fits", and the words of the subject that are file names, such as "cube.fits" in "the
 * moment images of cube.fits". Also finds absolute paths, such as "/data/cube.fits" in "File
 * /data/cube.fits does not exist", without the punctuation after them. A path with a space is found
 * only up to the space.
 */
export function splitFileNames(text: string, subject: string): TextPart[] {
    const names = [...(isFileName(subject) ? [subject] : []), ...subject.split(/\s+/).filter(isFileName)];
    // A path starts with a slash that does not follow a letter, a slash or a colon, so that a URL is not taken as a path.
    const patterns = ["(?<![\\w/:])/[^\\s:;,]*[^\\s:;,.)]", ...names.sort((a, b) => b.length - a.length).map(escapeRegExp)];
    const pattern = new RegExp(patterns.join("|"), "g");
    const parts: TextPart[] = [];
    let last = 0;
    for (const match of text.matchAll(pattern)) {
        const index = match.index ?? 0;
        if (index > last) {
            parts.push({text: text.slice(last, index), isFile: false});
        }
        parts.push({text: match[0], isFile: true});
        last = index + match[0].length;
    }
    if (last < text.length) {
        parts.push({text: text.slice(last), isFile: false});
    }
    return parts;
}
