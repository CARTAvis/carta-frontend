import * as React from "react";
import {AnchorButton, Classes, Dialog, H4, Intent, Tag, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {WorkspaceIssueOutcome} from "enums";
import {type WorkspaceIssue} from "models";
import {AppStore} from "stores";

import {describeIssue, describeWidgetGroup, groupRestoreReport, splitFileNames, type WidgetGroup} from "./restoreReportGroups";

import "./WorkspaceRestoreReportDialogComponent.scss";

/** Returns a path such as /data/cube.fits, from a directory that may be empty. */
function pathOf(directory: string | undefined, filename: string): string {
    return directory ? `${directory.replace(/\/$/, "")}/${filename}` : filename;
}

/**
 * Marks an item as failed or skipped. An item listed under its cause has a lighter tag, so that the
 * item that caused it stands out.
 */
const OutcomeTag = ({issue, isUnderCause = false}: {issue: WorkspaceIssue; isUnderCause?: boolean}) => {
    const isSkipped = issue.outcome === WorkspaceIssueOutcome.Skipped;
    return (
        <Tag minimal={isUnderCause} intent={isSkipped ? Intent.WARNING : Intent.DANGER} icon={isSkipped ? "disable" : "error"} className="outcome-tag">
            {isSkipped ? "Skipped" : "Failed"}
        </Tag>
    );
};

/** Shows a file name or a path. A long path breaks after a slash, not inside a name. */
const FileName = ({text}: {text: string}) => (
    <span className="file-name">
        {text.split(/(?<=\/)/).map((piece, index) => (
            <React.Fragment key={index}>
                {index > 0 && <wbr />}
                {piece}
            </React.Fragment>
        ))}
    </span>
);

/** Shows a report line, with the file names and paths in a monospace font. */
const IssueText = ({issue, text}: {issue: WorkspaceIssue; text: string}) => (
    <span>{splitFileNames(text, issue.subject).map((part, index) => (part.isFile ? <FileName key={index} text={part.text} /> : <React.Fragment key={index}>{part.text}</React.Fragment>))}</span>
);

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
    const repointed = [...(report?.repointed?.images.values() ?? []), ...(report?.repointed?.catalogs.values() ?? [])].map(({to}) => to);
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
                {groups.leftOut.length > 0 && (
                    <section data-testid="workspace-restore-report-left-out">
                        <H4>Not restored</H4>
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
                        <H4>Restored with changes</H4>
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
                        <H4>Opened from new locations ({repointed.length})</H4>
                        <p>{report?.storedName !== undefined ? "The stored workspace still names the old files until you save the new locations in it." : "This workspace cannot be changed, so it keeps the old locations."}</p>
                        <ul>
                            {repointed.map((source, index) => (
                                <li key={index}>
                                    <span>{pathOf(source.directory, source.filename)}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
            <div className={Classes.DIALOG_FOOTER}>
                <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                    {repointed.length > 0 && report?.storedName !== undefined && (
                        <Tooltip content="Change only the locations of these files in the stored workspace">
                            <AnchorButton
                                icon={writeBack === "written" ? "tick" : "floppy-disk"}
                                loading={writeBack === "writing"}
                                disabled={writeBack !== "none"}
                                onClick={appStore.writeBackRepointedLocations}
                                data-testid="workspace-restore-report-write-back-button"
                            >
                                {writeBack === "written" ? "New locations saved" : writeBack === "outdated" ? "New locations not saved" : "Save new locations in workspace"}
                            </AnchorButton>
                        </Tooltip>
                    )}
                    <AnchorButton intent={Intent.PRIMARY} onClick={appStore.closeWorkspaceRestoreReport} data-testid="workspace-restore-report-close-button">
                        Close
                    </AnchorButton>
                </div>
            </div>
        </Dialog>
    );
});
