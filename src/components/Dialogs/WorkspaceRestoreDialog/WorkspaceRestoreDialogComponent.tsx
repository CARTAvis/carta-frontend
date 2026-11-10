import * as React from "react";
import {AnchorButton, Classes, Dialog, ProgressBar, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {AppStore} from "stores";

import {FileNameText} from "../WorkspaceRestoreReportDialog/FileNameText";

import {WorkspaceRecoveryComponent} from "./WorkspaceRecoveryComponent";

import "./WorkspaceRestoreDialogComponent.scss";

/** Returns how much time is left, such as "1m05s" or "09s". */
function formatTimeRemaining(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const secondsText = String(seconds % 60).padStart(2, "0");
    return minutes > 0 ? `${minutes}m${secondsText}s` : `${secondsText}s`;
}

/**
 * Counts down to the time when a step stops waiting, such as "Gives up in 42s". It shows nothing
 * once that time has passed.
 */
const Countdown = ({deadline}: {deadline: number}) => {
    const [now, setNow] = React.useState(Date.now);
    React.useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [deadline]);
    const remaining = deadline - now;
    return remaining > 0 ? (
        <span className="restore-step-time" data-testid="workspace-restore-step-countdown">
            Gives up in {Math.ceil(remaining / 1000)}s
        </span>
    ) : null;
};

/**
 * Shows the progress of a workspace restore: the stage, the item of the stage, and what the restore
 * waits for. When a stage has items that failed, it shows them instead, with a choice for each, until
 * the user continues. Cancel stops the restore at any time. It clears the session if the restore
 * has changed it.
 *
 * The dialog hides while the user chooses a file for an item in the file browser. Otherwise it would
 * cover the file browser.
 */
export const WorkspaceRestoreDialogComponent = observer(() => {
    const appStore = AppStore.Instance;
    const progress = appStore.workspaceRestoreProgress;
    const recovery = appStore.workspaceRecovery;
    const step = appStore.workspaceLoadingStep;
    const name = appStore.loadingWorkspaceName;

    // The bar shows the items of the stage that are done. A stage without items shows a moving bar.
    const index = progress?.index;
    const count = progress?.count;
    const fraction = index !== undefined && count ? (index - 1) / count : undefined;
    const stageText = fraction !== undefined ? `${progress?.stage} ${index}/${count}` : (progress?.stage ?? "");
    const timeRemaining = step ? appStore.estimatedTaskRemainingTime : undefined;

    return (
        <Dialog
            portalClassName="dialog-portal"
            className={classNames("workspace-restore-dialog", {[Classes.DARK]: appStore.isDarkTheme})}
            icon="folder-open"
            title={name ? `Opening workspace "${name}"` : "Opening workspace"}
            canEscapeKeyClose={false}
            canOutsideClickClose={false}
            isCloseButtonShown={false}
            isOpen={appStore.isLoadingWorkspace && !appStore.isResumingSession && !appStore.fileBrowserStore.filePick}
        >
            <div className={Classes.DIALOG_BODY}>
                {recovery ? (
                    <WorkspaceRecoveryComponent recovery={recovery} />
                ) : (
                    <>
                        <div className="restore-stage" data-testid="workspace-restore-stage">
                            {stageText}
                        </div>
                        <div className="restore-item" data-testid="workspace-restore-item" title={progress?.item}>
                            {progress?.item ?? " "}
                        </div>
                        <ProgressBar value={fraction} animate={fraction === undefined} stripes={fraction === undefined} intent="primary" />
                        {step && (
                            <div className="restore-step" data-testid="workspace-restore-step">
                                <div className="restore-step-text">
                                    <span className="restore-step-description" title={step.description}>
                                        {/* Show a mirror host or a path in the step in the font of the file names. */}
                                        <FileNameText text={step.description} subject="" />
                                    </span>
                                    {step.deadline !== undefined ? <Countdown deadline={step.deadline} /> : timeRemaining ? <span className="restore-step-time">{formatTimeRemaining(timeRemaining)} left</span> : null}
                                </div>
                                <div className="restore-step-progress">
                                    <ProgressBar value={step.progress || undefined} animate={!step.progress} stripes={!step.progress} intent="primary" />
                                    {step.onSkip && (
                                        <Tooltip content="Skip this step and restore the rest of the workspace">
                                            <AnchorButton size="small" onClick={step.onSkip} data-testid="workspace-restore-skip-button">
                                                Skip
                                            </AnchorButton>
                                        </Tooltip>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
            <div className={Classes.DIALOG_FOOTER}>
                <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                    {/* In Recovery, Cancel stands apart at the left, so that it is not taken for Continue. */}
                    <Tooltip content="Stop opening the workspace, and close what it has opened so far" className={recovery ? "restore-cancel-apart" : undefined}>
                        <AnchorButton onClick={appStore.cancelLoadingWorkspace} data-testid="workspace-restore-cancel-button">
                            {recovery ? "Cancel restore" : "Cancel"}
                        </AnchorButton>
                    </Tooltip>
                    {recovery && (
                        <>
                            <Tooltip content="Skip every item in the list, and restore the rest of the workspace">
                                <AnchorButton onClick={recovery.skipAll} data-testid="workspace-recovery-skip-all-button">
                                    Skip all
                                </AnchorButton>
                            </Tooltip>
                            <Tooltip content={recovery.canContinue ? "Do what you chose for each item, and restore the rest of the workspace" : "Choose what to do with each item first"}>
                                <AnchorButton intent="primary" disabled={!recovery.canContinue} onClick={recovery.continue} data-testid="workspace-recovery-continue-button">
                                    Continue
                                </AnchorButton>
                            </Tooltip>
                        </>
                    )}
                </div>
            </div>
        </Dialog>
    );
});
