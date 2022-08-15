import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import {AnchorButton, Classes, Dialog, ProgressBar} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {AppStore} from "stores";
import {toFixed} from "utilities";
import "./TaskProgressDialogComponent.scss";

interface TaskProgressDialogComponentProps {
    progress: number;
    timeRemaining: number;
    isOpen: boolean;
    cancellable: boolean;
    onCancel?: () => void;
    text: string;
    contentText?: string;
    isCancelling?: boolean;
}

@observer
export class TaskProgressDialogComponent extends React.Component<TaskProgressDialogComponentProps> {
    render() {
        let titleText = this.props.text;
        let timeRemainingText;
        if (this.props.timeRemaining) {
            const numSeconds = this.props.timeRemaining * 1e-3;
            if (numSeconds > 60) {
                const numMinutes = Math.floor(numSeconds / 60);
                const remainingSeconds = Math.floor(numSeconds - numMinutes * 60);
                const secondsText = remainingSeconds >= 10 ? toFixed(remainingSeconds) : `0${toFixed(remainingSeconds)}`;
                timeRemainingText = `${numMinutes}m${secondsText}s`;
            } else {
                const remainingSeconds = Math.floor(numSeconds);
                const secondsText = remainingSeconds >= 10 ? toFixed(remainingSeconds) : `0${toFixed(remainingSeconds)}`;
                timeRemainingText = `${secondsText}s`;
            }
            titleText = `${this.props.text} (${timeRemainingText} left)`;
        }

        const className = classNames("task-progress-dialog", {"bp4-dark": AppStore.Instance.darkTheme});
        const cancellingText = this.props.isCancelling ? `cancellation in progress${".".repeat(Math.floor(performance.now() / 1000) % 4)}` : "";

        return (
            <Dialog portalClassName="dialog-portal" className={className} icon={"time"} canEscapeKeyClose={false} canOutsideClickClose={false} isCloseButtonShown={false} title={titleText} isOpen={this.props.isOpen}>
                <div className={Classes.DIALOG_BODY}>
                    <ProgressBar value={this.props.progress} animate={!isFinite(this.props.progress)} stripes={!isFinite(this.props.progress)} intent={"primary"} />
                    <>{this.props.contentText}</>
                </div>
                {this.props.cancellable && (
                    <div className={Classes.DIALOG_FOOTER}>
                        <div className="footer-text">{cancellingText}</div>
                        <div className="footer-button">
                            <Tooltip2 content="Cancel the current task">
                                <AnchorButton onClick={this.props.onCancel} disabled={this.props.isCancelling}>
                                    Cancel
                                </AnchorButton>
                            </Tooltip2>
                        </div>
                    </div>
                )}
            </Dialog>
        );
    }
}
