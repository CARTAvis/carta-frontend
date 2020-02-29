import * as React from "react";
import {observer} from "mobx-react";
import {action, computed, observable} from "mobx";
import {AnchorButton, Classes, EditableText, IDialogProps, Intent} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore} from "stores";
import "./DebugExecutionDialogComponent.css";

class ExecutionEntry {

    private static Delay(timeout: number) {
        return new Promise<void>(resolve => {
            setTimeout(resolve, timeout);
        });
    }

    action: any;
    parameters: any[];
    valid: boolean;
    async: boolean;
    private appStore: AppStore;

    constructor(entry: string, appStore: AppStore) {
        this.appStore = appStore;

        entry = entry.trim();
        if (entry.length && entry.charAt(0) === "+") {
            this.async = true;
            entry = entry.substring(1);
        }
        const entryRegex = /^(\S+)\((.*)\)$/gm;
        if (!entryRegex.test(entry)) {
            this.valid = false;
            return;
        } else {
            const actionString = entry.substring(0, entry.indexOf("("));
            this.action = appStore[actionString];
            if (!this.action || typeof (this.action) !== "function") {
                this.valid = false;
                return;
            }
            this.action.bind(appStore);
            let parameterString = entry.substring(entry.indexOf("(") + 1, entry.lastIndexOf(")"));

            if (parameterString) {
                // Macro replacement
                parameterString = parameterString.replace("$ActiveFrame", `"$ActiveFrame"`);

                try {
                    this.parameters = JSON.parse(`[${parameterString}]`);
                    if (!Array.isArray(this.parameters) || !this.parameters.length) {
                        console.log("Invalid parameter array");
                        this.valid = false;
                        return;
                    }
                } catch (e) {
                    console.log(e);
                    this.valid = false;
                    return;
                }
            }

            this.valid = true;
        }
    }

    async execute() {
        try {
            let response;
            if (this.parameters && this.parameters.length) {
                const currentParameters = this.parameters.map(this.mapMacro);

                if (this.async) {
                    response = await this.action(...currentParameters);
                    await ExecutionEntry.Delay(10);
                } else {
                    response = this.action(...currentParameters);
                }
            } else {
                if (this.async) {
                    response = await this.action();
                    await ExecutionEntry.Delay(10);
                } else {
                    response = this.action();
                }
            }
            console.log(response);
        } catch (e) {
            console.log(e);
        }
    }

    private mapMacro = (parameter: any) => {
        // For now, only a few macros supported
        if (parameter === "$ActiveFrame") {
            return this.appStore.activeFrame;
        } else if (parameter === "$SpatialReference") {
            return this.appStore.spatialReference;
        } else if (parameter === "$SpectralReference") {
            return this.appStore.spectralReference;
        } else if (parameter === "$ContourDataSource") {
            return this.appStore.contourDataSource;
        }

        return parameter;
    };
}

@observer
export class DebugExecutionDialogComponent extends React.Component<{ appStore: AppStore }> {
    @observable inputString: string = "";
    @observable isExecuting: boolean;
    @observable errorString: string = "";

    @computed get executionEntries() {
        const appStore = this.props.appStore;
        let entries = this.inputString.split(";");
        let executionStrings = new Array<ExecutionEntry>();

        for (let entry of entries) {
            if (!entry) {
                continue;
            }
            const executionEntry = new ExecutionEntry(entry, appStore);
            if (!executionEntry.valid) {
                return [];
            } else {
                executionStrings.push(executionEntry);
            }
        }

        return executionStrings;
    }

    public render() {
        const appStore = this.props.appStore;
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
            isCloseButtonShown: true,
            title: "Execute a command"
        };

        const validInput = (this.executionEntries && this.executionEntries.length);

        return (
            <DraggableDialogComponent appStore={appStore} dialogProps={dialogProps} defaultWidth={500} defaultHeight={300} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <EditableText className="input-text" onChange={this.handleActionInput} value={this.inputString} minLines={5} intent={!validInput ? "warning" : "success"} placeholder="Enter execution string" multiline={true}/>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.PRIMARY} onClick={this.onExecuteClicked} disabled={!validInput || this.isExecuting} text="Execute"/>
                        <AnchorButton intent={Intent.NONE} onClick={appStore.dialogStore.hideDebugExecutionDialog} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }

    @action handleActionInput = (newValue: string) => {
        this.inputString = newValue;
    };

    // TODO: This should be moved to a scripting service
    onExecuteClicked = async () => {
        if (!this.executionEntries || !this.executionEntries.length) {
            return;
        }

        this.isExecuting = true;

        for (const entry of this.executionEntries) {
            await entry.execute();
        }

        this.isExecuting = false;
    };
}