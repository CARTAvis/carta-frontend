import * as React from "react";
import {AnchorButton, Classes, Dialog, ProgressBar, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {AppStore} from "stores";

import "./WorkspaceRestoreDialogComponent.scss";

/** Returns how much time is left, such as "1m05s" or "09s". */
function formatTimeRemaining(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const secondsText = String(seconds % 60).padStart(2, "0");
    return minutes > 0 ? `${minutes}m${secondsText}s` : `${secondsText}s`;
}

/**
 * Shows the progress of a workspace restore: the stage, the item of the stage, and what the restore
 * waits for. Cancel stops the restore at any time, and leaves the session empty.
 */
export const WorkspaceRestoreDialogComponent = observer(() => {
    const appStore = AppStore.Instance;
    const progress = appStore.workspaceRestoreProgress;
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
            isOpen={appStore.isLoadingWorkspace && !appStore.isResumingSession}
        >
            <div className={Classes.DIALOG_BODY}>
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
                                {step.description}
                            </span>
                            {timeRemaining ? <span className="restore-step-time">{formatTimeRemaining(timeRemaining)} left</span> : null}
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
            </div>
            <div className={Classes.DIALOG_FOOTER}>
                <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                    <Tooltip content="Stop opening the workspace, and close what it has opened so far">
                        <AnchorButton onClick={appStore.cancelLoadingWorkspace} data-testid="workspace-restore-cancel-button">
                            Cancel
                        </AnchorButton>
                    </Tooltip>
                </div>
            </div>
        </Dialog>
    );
});
