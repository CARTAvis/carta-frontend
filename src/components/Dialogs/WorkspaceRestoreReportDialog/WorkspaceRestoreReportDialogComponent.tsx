import * as React from "react";
import {AnchorButton, Classes, Dialog, H5, Icon, type IconName, Intent, Tag, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {WorkspaceIssueOutcome} from "enums";
import {describeCatalogSource, describeImageSource, type WorkspaceIssue} from "models";
import {AppStore} from "stores";

import {FileName, FileNameText, ItemIcon} from "./FileNameText";
import {describeIssue, describeWidgetGroup, groupRestoreReport, type WidgetGroup} from "./restoreReportGroups";

import "./WorkspaceRestoreReportDialogComponent.scss";

/** Returns the count of a thing, such as "1 item" or "2 items". */
function countOf(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`;
}

/** Shows the title of a section of the report, with an icon. */
const SectionTitle = ({icon, children}: {icon: IconName; children: React.ReactNode}) => (
    <H5 className="report-section-title">
        <Icon icon={icon} />
        {children}
    </H5>
);

/** Marks an item as failed or skipped, at the right of its name. */
const OutcomeTag = ({issue}: {issue: WorkspaceIssue}) => {
    const isSkipped = issue.outcome === WorkspaceIssueOutcome.Skipped;
    return (
        <Tag minimal intent={isSkipped ? Intent.WARNING : Intent.DANGER} className="outcome-tag">
            {isSkipped ? "Skipped" : "Failed"}
        </Tag>
    );
};

/** Shows a report line, with the file names and paths in a monospace font. */
const IssueText = ({issue, text}: {issue: WorkspaceIssue; text: string}) => <FileNameText text={text} subject={issue.subject} label={issue.label} />;

/**
 * Shows an item as the Recovery dialog does: its name on the first line, and the reason on the
 * line below. An item without a name shows its message on the first line.
 *
 * @param shouldShowReason - whether to show the reason. An item listed under its cause does not need it.
 * @param tag - what to show at the right of the name, such as the outcome.
 */
const ItemLines = ({issue, titleOfWidget, shouldShowReason = true, tag}: {issue: WorkspaceIssue; titleOfWidget: (widgetId: string) => string; shouldShowReason?: boolean; tag?: React.ReactNode}) => {
    const name = describeIssue(issue, titleOfWidget, false);
    const reason = name !== issue.message && shouldShowReason ? issue.reason : undefined;
    return (
        <>
            <div className="issue item-name">
                <ItemIcon kind={issue.kind} />
                <IssueText issue={issue} text={name} />
                {tag}
            </div>
            {reason && (
                <div className="item-reason">
                    <IssueText issue={issue} text={reason} />
                </div>
            )}
        </>
    );
};

/** Lists widgets by their titles, under the line that says what they show now. */
const WidgetGroupLines = ({group, isUnderCause, titleOfWidget}: {group: WidgetGroup; isUnderCause: boolean; titleOfWidget: (widgetId: string) => string}) => (
    <div className="widget-group">
        <div className="consequence-caption">{describeWidgetGroup(group, isUnderCause).replace(/:$/, "")}</div>
        <div className="widget-titles">
            {group.widgetIds.map(widgetId => (
                <Tag key={widgetId} minimal>
                    {titleOfWidget(widgetId)}
                </Tag>
            ))}
        </div>
    </div>
);

/**
 * Lists what the last workspace restore could not bring back as saved, in three groups:
 * - items that are not in the session, each marked as failed or skipped. Under each item, the
 *   report lists what the restore left out or changed because of it, such as the widgets that
 *   showed a skipped image.
 * - items that are in the session, but not as saved.
 * - images and catalogs that opened from a file that the user chose. The user can write these new
 *   locations to the stored workspace, and change nothing else in it.
 */
export const WorkspaceRestoreReportDialogComponent = observer(() => {
    const appStore = AppStore.Instance;
    // Keep showing the last report while the dialog fades out after it is closed.
    const lastReport = React.useRef(appStore.workspaceRestoreReport);
    if (appStore.workspaceRestoreReport) {
        lastReport.current = appStore.workspaceRestoreReport;
    }
    const report = lastReport.current;
    const issues = report?.issues ?? [];
    const groups = groupRestoreReport(issues);
    const titleOfWidget = (widgetId: string) => appStore.widgetsStore.titleOfWidget(widgetId);
    const hasConsequences = groups.leftOut.some(item => item.leftOut.length > 0 || item.widgets.length > 0 || item.changed.length > 0);
    // The file that the workspace saved, and the file that the user chose for it.
    const repointed = [
        ...[...(report?.repointed?.images.values() ?? [])].map(({from, to}) => ({from: describeImageSource(from), to})),
        ...[...(report?.repointed?.catalogs.values() ?? [])].map(({from, to}) => ({from: describeCatalogSource(from), to}))
    ];
    const leftOutCount = issues.filter(issue => issue.outcome).length;
    // Count the items that the section lists. A widget listed under its cause is not counted again.
    const changedCount = groups.changed.reduce((count, item) => count + ("widgets" in item ? item.widgets.widgetIds.length : 1), 0);
    const writeBack = appStore.workspaceWriteBack;

    return (
        <Dialog
            portalClassName="dialog-portal"
            className={classNames("workspace-restore-report-dialog", {[Classes.DARK]: appStore.isDarkTheme})}
            icon={issues.length ? "warning-sign" : "info-sign"}
            title={
                <>
                    Workspace restore report
                    <span className="report-workspace-name">{report?.name}</span>
                </>
            }
            isOpen={!!appStore.workspaceRestoreReport}
            onClose={appStore.closeWorkspaceRestoreReport}
            canOutsideClickClose={false}
        >
            <div className={Classes.DIALOG_BODY}>
                {/* Sum up the sections only when there are two or more. One section says it by its title. */}
                {[leftOutCount, changedCount, repointed.length].filter(count => count > 0).length > 1 && (
                    <div className="report-summary" data-testid="workspace-restore-report-summary">
                        {leftOutCount > 0 && (
                            <Tag minimal intent={Intent.WARNING}>
                                {countOf(leftOutCount, "item", "items")} not restored
                            </Tag>
                        )}
                        {changedCount > 0 && <Tag minimal>{countOf(changedCount, "item", "items")} restored with changes</Tag>}
                        {repointed.length > 0 && (
                            <Tag minimal intent={Intent.PRIMARY}>
                                {countOf(repointed.length, "file", "files")} from a new location
                            </Tag>
                        )}
                    </div>
                )}
                {groups.leftOut.length > 0 && (
                    <section data-testid="workspace-restore-report-left-out">
                        <SectionTitle icon="remove">Not restored</SectionTitle>
                        <p>{hasConsequences ? "These items are not in the session. Under each item is what was left out or changed because of it." : "These items are not in the session."}</p>
                        <ul role="list">
                            {groups.leftOut.map((item, index) => (
                                <li key={index} className={classNames("left-out-item", item.issue.outcome === WorkspaceIssueOutcome.Skipped ? "is-skipped" : "is-failed")}>
                                    <ItemLines issue={item.issue} titleOfWidget={titleOfWidget} tag={<OutcomeTag issue={item.issue} />} />
                                    {(item.leftOut.length > 0 || item.widgets.length > 0 || item.changed.length > 0) && (
                                        <div className="consequences" aria-label="Because of this" data-testid="workspace-restore-report-consequences">
                                            {item.leftOut.length > 0 && (
                                                <div>
                                                    <div className="consequence-caption">Also left out</div>
                                                    <ul role="list">
                                                        {item.leftOut.map((issue, consequenceIndex) => (
                                                            <li key={consequenceIndex}>
                                                                <ItemLines issue={issue} titleOfWidget={titleOfWidget} shouldShowReason={false} />
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {item.widgets.map(group => (
                                                <WidgetGroupLines key={`${group.effect}-${group.detail ?? ""}`} group={group} isUnderCause={true} titleOfWidget={titleOfWidget} />
                                            ))}
                                            {item.changed.length > 0 && (
                                                <div>
                                                    <div className="consequence-caption">Also changed</div>
                                                    <ul role="list">
                                                        {item.changed.map((issue, consequenceIndex) => (
                                                            <li key={consequenceIndex}>
                                                                <ItemLines issue={issue} titleOfWidget={titleOfWidget} />
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
                {groups.changed.length > 0 && (
                    <section data-testid="workspace-restore-report-changed">
                        <SectionTitle icon="changes">Restored with changes</SectionTitle>
                        <p>These items are in the session, but not as they were saved.</p>
                        <ul role="list">
                            {groups.changed.map((item, index) => (
                                <li key={index}>{"widgets" in item ? <WidgetGroupLines group={item.widgets} isUnderCause={false} titleOfWidget={titleOfWidget} /> : <ItemLines issue={item.issue} titleOfWidget={titleOfWidget} />}</li>
                            ))}
                        </ul>
                    </section>
                )}
                {repointed.length > 0 && (
                    <section data-testid="workspace-restore-report-repointed">
                        <div className="report-section-header">
                            <SectionTitle icon="folder-shared-open">Opened from new locations</SectionTitle>
                            {report?.storedName !== undefined && (
                                <Tooltip content={writeBack === "outdated" ? "The stored workspace changed after this restore, so it was not changed" : "Change only the locations of these files in the stored workspace"}>
                                    <AnchorButton
                                        size="small"
                                        icon={writeBack === "written" ? "tick" : "floppy-disk"}
                                        loading={writeBack === "writing"}
                                        disabled={writeBack !== "none"}
                                        onClick={appStore.writeBackRepointedLocations}
                                        data-testid="workspace-restore-report-write-back-button"
                                    >
                                        {writeBack === "written" ? "Saved in workspace" : writeBack === "outdated" ? "Not saved" : "Save in workspace"}
                                    </AnchorButton>
                                </Tooltip>
                            )}
                        </div>
                        <p>
                            {report?.storedName === undefined
                                ? "This workspace cannot be changed, so it keeps the old locations."
                                : writeBack === "written"
                                  ? "The stored workspace now names the new files."
                                  : "The stored workspace still names the old files."}
                        </p>
                        <ul role="list">
                            {repointed.map(({from, to}, index) => (
                                <li key={index} className="repointed-item">
                                    <div>
                                        <FileName text={from} />
                                        <Icon icon="arrow-right" size={12} className="repointed-arrow" />
                                        <FileName text={to.filename} />
                                    </div>
                                    {/* The file browser names a folder from the top-level folder, so the path has no leading slash. */}
                                    <div className="repointed-folder">
                                        Folder: {to.directory ? <FileName text={to.directory} /> : "the top-level folder"}
                                        {to.directory ? " (from the top-level folder)" : ""}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
            <div className={Classes.DIALOG_FOOTER}>
                <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                    <AnchorButton intent={Intent.PRIMARY} onClick={appStore.closeWorkspaceRestoreReport} data-testid="workspace-restore-report-close-button">
                        Close
                    </AnchorButton>
                </div>
            </div>
        </Dialog>
    );
});
