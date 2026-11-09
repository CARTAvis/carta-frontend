import * as React from "react";
import {AnchorButton, Classes, Dialog, H4, Intent, Tag} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {WorkspaceIssueOutcome} from "enums";
import {AppStore} from "stores";

import "./WorkspaceRestoreReportDialogComponent.scss";

/**
 * Lists what the last workspace restore could not bring back as saved, in two groups:
 * - items that are not in the session, each marked as failed or skipped.
 * - items that are in the session, but not as saved.
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
    const leftOut = issues.filter(issue => issue.outcome);
    const changed = issues.filter(issue => !issue.outcome);

    return (
        <Dialog
            portalClassName="dialog-portal"
            className={classNames("workspace-restore-report-dialog", {[Classes.DARK]: appStore.isDarkTheme})}
            icon="warning-sign"
            title={`Workspace "${report?.name ?? ""}" was not fully restored`}
            isOpen={!!appStore.workspaceRestoreReport}
            onClose={appStore.closeWorkspaceRestoreReport}
            canOutsideClickClose={false}
        >
            <div className={Classes.DIALOG_BODY}>
                {leftOut.length > 0 && (
                    <section data-testid="workspace-restore-report-left-out">
                        <H4>Not restored ({leftOut.length})</H4>
                        <p>These items are not in the session.</p>
                        <ul>
                            {leftOut.map((issue, index) => (
                                <li key={index}>
                                    <Tag minimal intent={issue.outcome === WorkspaceIssueOutcome.Skipped ? Intent.NONE : Intent.DANGER}>
                                        {issue.outcome === WorkspaceIssueOutcome.Skipped ? "Skipped" : "Failed"}
                                    </Tag>
                                    <span>{issue.message}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
                {changed.length > 0 && (
                    <section data-testid="workspace-restore-report-changed">
                        <H4>Restored with changes ({changed.length})</H4>
                        <p>These items are in the session, but not as they were saved.</p>
                        <ul>
                            {changed.map((issue, index) => (
                                <li key={index}>
                                    <span>{issue.message}</span>
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
