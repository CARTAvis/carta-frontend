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

    target: string;
    action: string;
    parameters: any[];
    valid: boolean;
    async: boolean;
    private readonly appStore: AppStore;

    constructor(entry: string, appStore: AppStore) {
        this.appStore = appStore;
        entry = entry.trim();

        const entryRegex = /^(\+?)((?:[\w\[\]]+\.)*)(\w+)\(([^)]*)\);?$/gm;
        const matches = entryRegex.exec(entry);
        // Four matching groups, first entry is the full match
        if (matches && matches.length === 5 && matches[3].length) {
            this.async = matches[1].length > 0;
            if (matches[2].length) {
                this.target = matches[2].substring(0, matches[2].length - 1);
            }
            this.action = matches[3];
            const parameterRegex = /(\$(?:[\w\[\]]+\.)*)([\w\[\]]+)/gm;
            try {
                const substitutedParameterString = matches[4].replace(parameterRegex, "{\"macroTarget\": \"$1\", \"macroVariable\": \"$2\"}");
                const parameterArray = JSON.parse(`[${substitutedParameterString}]`);
                this.parameters = parameterArray.map(parameter => {
                    if (typeof parameter === "object" && parameter.macroTarget && parameter.macroVariable) {
                        parameter.macroTarget = parameter.macroTarget.slice(1, -1);
                    }
                    return parameter;
                });
            } catch (e) {
                console.log(e);
                this.valid = false;
                return;
            }
            this.valid = true;
        } else {
            this.valid = false;
        }

        /*
        if (entry.length && entry.charAt(0) === "+") {
            this.async = true;
            entry = entry.substring(1);
        }
        const entryRegex = /^(\S+)\((.*)\);?$/gm;
        if (!entryRegex.test(entry)) {
            this.valid = false;
            return;
        } else {
            const actionString = entry.substring(0, entry.indexOf("("));
            const actionArray = actionString.split(".");

            // Determine the action target by traversing object tree
            let target = this.appStore;
            for (let i = 0; i < actionArray.length - 1; i++) {
                target = target[actionArray[i]];
                if (target == null) {
                    this.valid = false;
                    return;
                }
            }

            // Determine the action function
            this.action = target[actionArray[actionArray.length - 1]];
            if (!this.action || typeof (this.action) !== "function") {
                this.valid = false;
                return;
            }
            this.action.bind(target);

            let argumentString = entry.substring(entry.indexOf("(") + 1, entry.lastIndexOf(")"));

            if (argumentString) {
                const parameterStringArray = argumentString.split(",");
                this.parameters = [];
                for (let parameterString of parameterStringArray) {
                    parameterString = parameterString.trim();
                    try {
                        if (parameterString.startsWith("$")) {
                            this.parameters.push({macroName: parameterString.substring(1)});
                        } else {
                            this.parameters.push(JSON.parse(parameterString));
                        }
                    } catch (e) {
                        this.valid = false;
                        return;
                    }
                }
            }
            this.valid = true;
        }*/
    }

    async execute() {
        const targetObject = ExecutionEntry.GetTargetObject(this.appStore, this.target);
        if (targetObject == null) {
            console.log(`Missing target object: ${this.target}`);
            return;
        }
        const currentParameters = this.parameters.map(this.mapMacro);
        const actionFunction = targetObject[this.action];
        if (!actionFunction || typeof (actionFunction) !== "function") {
            console.log(`Missing action function: ${this.action}`);
            console.log(actionFunction);
            return;
        }
        actionFunction.bind(targetObject);
        let response;
        if (this.async) {
            response = await actionFunction(...currentParameters);
            await ExecutionEntry.Delay(10);
        } else {
            response = actionFunction(...currentParameters);
        }
        return response;
    }

    private static GetTargetObject(baseObject: any, targetString: string) {
        if (!targetString) {
            return baseObject;
        }

        let target = baseObject;
        const targetNameArray = targetString.split(".");
        for (const targetEntry of targetNameArray) {
            const arrayRegex = /(\w+)(?:\[(\d+)\])?/gm;
            const matches = arrayRegex.exec(targetEntry);
            // Check if there's an array index in this parameter
            if (matches && matches.length === 3 && matches[2] !== undefined) {
                target = target[matches[1]];
                if (target == null) {
                    return null;
                }
                target = target[matches[2]];
            } else {
                target = target[targetEntry];
            }
            if (target == null) {
                return null;
            }
        }
        return target;
    }

    private mapMacro = (parameter: any) => {
        if (typeof parameter === "object" && parameter.macroVariable) {
            const targetString = parameter.macroTarget ? `${parameter.macroTarget}.${parameter.macroVariable}` : parameter.macroVariable;
            return ExecutionEntry.GetTargetObject(this.appStore, targetString);
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
        let entries = this.inputString.split("\n");
        let executionStrings = new Array<ExecutionEntry>();

        for (let entry of entries) {
            if (!entry || !entry.length || entry.startsWith("//")) {
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
            try {
                await entry.execute();
            } catch (err) {
                console.log(err);
            }
        }

        this.isExecuting = false;
    };
}