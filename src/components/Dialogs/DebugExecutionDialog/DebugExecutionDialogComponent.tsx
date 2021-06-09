import * as React from "react";
import {observer} from "mobx-react";
import {action, computed, makeObservable, observable} from "mobx";
import {AnchorButton, Classes, EditableText, IDialogProps, Intent} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {ExecutionEntry, ScriptingService} from "services";
import {AppStore} from "stores";
import "./DebugExecutionDialogComponent.scss";

@observer
export class DebugExecutionDialogComponent extends React.Component {
    @observable inputString: string = localStorage.getItem("debugString") ?? "";
    @observable isExecuting: boolean;
    @observable errorString: string = "";

    @computed get executionEntries() {
        let entries = this.inputString.split("\n");
        let executionStrings = new Array<ExecutionEntry>();

        for (let entry of entries) {
            if (!entry || !entry.length || entry.startsWith("//")) {
                continue;
            }
            const executionEntry = ExecutionEntry.FromString(entry);
            if (!executionEntry.valid) {
                return [];
            } else {
                executionStrings.push(executionEntry);
            }
        }

        return executionStrings;
    }

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    public render() {
        const appStore = AppStore.Instance;
        let className = "debug-execution-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "console",
            className: className,
            canEscapeKeyClose: true,
            canOutsideClickClose: false,
            isOpen: appStore.dialogStore.debugExecutionDialogVisible,
            onClose: appStore.dialogStore.hideDebugExecutionDialog,
            isCloseButtonShown: true,
            title: "Execute a command"
        };

        const validInput = this.executionEntries && this.executionEntries.length;

        return (
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={700} defaultHeight={400} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <EditableText
                        className="input-text"
                        onChange={this.handleActionInput}
                        value={this.inputString}
                        minLines={5}
                        intent={!validInput ? "warning" : "success"}
                        placeholder="Enter execution string"
                        multiline={true}
                    />
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.PRIMARY} onClick={this.onExecuteClicked} disabled={!validInput || this.isExecuting} text="Execute" />
                        <AnchorButton
                            intent={Intent.WARNING}
                            onClick={() => appStore.backendService.scriptingStream.next(JSON.parse(this.inputString))}
                            text="DebugTest"
                        />
                        <AnchorButton intent={Intent.NONE} onClick={appStore.dialogStore.hideDebugExecutionDialog} text="Close" />
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }

    @action handleActionInput = (newValue: string) => {
        this.inputString = newValue;
    };

    onExecuteClicked = async () => {
        this.isExecuting = true;
        await ScriptingService.Instance.executeEntries(this.executionEntries);
        localStorage.setItem("debugString", this.inputString);
        this.isExecuting = false;
    };
}
