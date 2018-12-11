import {observer} from "mobx-react";
import * as React from "react";
import {Button, Classes, Dialog, ProgressBar, Tooltip} from "@blueprintjs/core";

interface TaskProgressDialogComponentProps {
    progress: number;
    isOpen: boolean;
    cancellable: boolean;
    onCancel?: () => void;
    text: string;
}

@observer
export class TaskProgressDialogComponent extends React.Component<TaskProgressDialogComponentProps> {

    render() {
        return (
            <Dialog
                className={"task-progress-dialog"}
                icon={"time"}
                canEscapeKeyClose={false}
                canOutsideClickClose={false}
                isCloseButtonShown={false}
                title={this.props.text}
                isOpen={this.props.isOpen}
            >
                <div className={Classes.DIALOG_BODY}>
                    <ProgressBar value={this.props.progress} animate={false} stripes={false}/>
                </div>
                {this.props.cancellable &&
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <Tooltip content="Cancel the current task">
                            <Button onClick={this.props.onCancel}>Cancel</Button>
                        </Tooltip>
                    </div>
                </div>
                }
            </Dialog>
        );
    }
}