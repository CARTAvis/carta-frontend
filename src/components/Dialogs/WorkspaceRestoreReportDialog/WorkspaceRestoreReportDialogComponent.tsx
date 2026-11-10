import * as React from "react";
import {AnchorButton, Classes, Dialog, H5, Icon, type IconName, Intent, Tag, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {WorkspaceIssueOutcome} from "enums";
import {describeCatalogSource, describeImageSource, type WorkspaceIssue} from "models";
import {AppStore} from "stores";

import {FileName, FileNameText} from "./FileNameText";
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

/**
 * Marks an item as failed or skipped. An item that is listed under its cause has a lighter tag. Then
 * the cause stands out.
 */
const OutcomeTag = ({issue, isUnderCause = false}: {issue: WorkspaceIssue; isUnderCause?: boolean}) => {
    const isSkipped = issue.outcome === WorkspaceIssueOutcome.Skipped;
    return (
        <Tag minimal={isUnderCause} intent={isSkipped ? Intent.WARNING : Intent.DANGER} icon={isSkipped ? "step-forward" : "error"} className="outcome-tag">
            {isSkipped ? "Skipped" : "Failed"}
        </Tag>
    );
};

/** Shows a report line, with the file names and paths in a monospace font. */
const IssueText = ({issue, text}: {issue: WorkspaceIssue; text: string}) => <FileNameText text={text} subject={issue.subject} label={issue.label} />;

/** Lists widgets by their titles, after the text that says what they show now. */
const WidgetGroupLine = ({group, isUnderCause, titleOfWidget}: {group: WidgetGroup; isUnderCause: boolean; titleOfWidget: (widgetId: string) => string}) => (
    <li className="widget-group">
        <span>{describeWidgetGroup(group, isUnderCause)}</span>
        <span className="widget-titles">
            {group.widgetIds.map(widgetId => (
                <Tag key={widgetId} minimal>
                    {titleOfWidget(widgetId)}
                </Tag>
            ))}
        </span>
    </li>
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
    const changedCount = issues.length - leftOutCount;
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
                {groups.leftOut.length > 0 && (
                    <section data-testid="workspace-restore-report-left-out">
                        <SectionTitle icon="remove">Not restored</SectionTitle>
                        <p>{hasConsequences ? "These items are not in the session. Under each item is what was left out or changed because of it." : "These items are not in the session."}</p>
                        <ul role="list">
                            {groups.leftOut.map((item, index) => (
                                <li key={index} className="left-out-item">
                                    <div className="issue">
                                        <OutcomeTag issue={item.issue} />
                                        <IssueText issue={item.issue} text={describeIssue(item.issue, titleOfWidget)} />
                                    </div>
                                    {(item.leftOut.length > 0 || item.widgets.length > 0 || item.changed.length > 0) && (
                                        <ul className="consequences" role="list" aria-label="Because of this" data-testid="workspace-restore-report-consequences">
                                            {item.leftOut.map((issue, consequenceIndex) => (
                                                <li key={`left-out-${consequenceIndex}`}>
                                                    <OutcomeTag issue={issue} isUnderCause={true} />
                                                    <IssueText issue={issue} text={describeIssue(issue, titleOfWidget, false)} />
                                                </li>
                                            ))}
                                            {item.widgets.map(group => (
                                                <WidgetGroupLine key={`${group.effect}-${group.detail ?? ""}`} group={group} isUnderCause={true} titleOfWidget={titleOfWidget} />
                                            ))}
                                            {item.changed.map((issue, consequenceIndex) => (
                                                <li key={`changed-${consequenceIndex}`}>
                                                    <IssueText issue={issue} text={describeIssue(issue, titleOfWidget)} />
                                                </li>
                                            ))}
                                        </ul>
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
                            {groups.changed.map((item, index) =>
                                "widgets" in item ? (
                                    <WidgetGroupLine key={index} group={item.widgets} isUnderCause={false} titleOfWidget={titleOfWidget} />
                                ) : (
                                    <li key={index}>
                                        <IssueText issue={item.issue} text={describeIssue(item.issue, titleOfWidget)} />
                                    </li>
                                )
                            )}
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
                        <p>{report?.storedName !== undefined ? "The stored workspace still names the old files." : "This workspace cannot be changed, so it keeps the old locations."}</p>
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
