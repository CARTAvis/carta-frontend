import * as React from "react";
import * as prism from "prismjs";
import {observer} from "mobx-react";
import {action, autorun, computed, makeObservable, observable} from "mobx";
import {AnchorButton, Classes, IDialogProps, Intent} from "@blueprintjs/core";
import Editor from "react-simple-code-editor";
import {DraggableDialogComponent} from "components/Dialogs";
import {Snippet} from "models";
import {AppStore, SnippetStore} from "stores";

import "prismjs/themes/prism.css";
import "./DebugExecutionDialogComponent.scss";

@observer
export class DebugExecutionDialogComponent extends React.Component {
    @observable inputString: string = "";
    @observable isExecuting: boolean;
    @observable errorString: string = "";
    @observable functionToExecute;
    private filledFromHistory: boolean = false;

    @computed get validInput() {
        return this.functionToExecute !== undefined;
    }

    @action setFunctionToExecute = f => {
        this.functionToExecute = f;
    };

    @action setInputString = (val: string) => {
        this.inputString = val;
    };

    constructor(props: any) {
        super(props);
        makeObservable(this);

        const snippetStore = SnippetStore.Instance;

        autorun(() => {
            const previousSnippet = snippetStore.snippets.get("_previous");
            if (!this.filledFromHistory && previousSnippet) {
                this.setInputString(previousSnippet.code);
                this.filledFromHistory = true;
            }
        });

        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

        if (AsyncFunction) {
            autorun(
                () => {
                    let f;
                    try {
                        f = new AsyncFunction(this.inputString);
                    } catch (e) {
                        f = undefined;
                    }
                    this.setFunctionToExecute(f);
                },
                {delay: 200}
            );
        }
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

        return (
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={700} defaultHeight={400} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <Editor
                        className={"language-js line-numbers"}
                        value={this.inputString}
                        onValueChange={this.handleActionInput}
                        highlight={this.applyHighlight}
                        tabSize={4}
                        padding={5}
                        textareaId="codeArea"
                        style={{
                            fontFamily: "'Fira code', 'Fira Mono', monospace",
                            fontSize: 12
                        }}
                        placeholder="Enter execution string"
                    />
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.PRIMARY} onClick={this.onExecuteClicked} disabled={!this.validInput || this.isExecuting} text="Execute" />
                        <AnchorButton intent={Intent.NONE} onClick={appStore.dialogStore.hideDebugExecutionDialog} text="Close" />
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }

    applyHighlight = (code: string) => {
        return prism
            .highlight(code, prism.languages.js, "js")
            .split("\n")
            .map((line, i) => `<span class='editor-line-number'>${i + 1}</span>${line}`)
            .join("\n");
    };

    @action handleActionInput = (newValue: string) => {
        this.inputString = newValue;
    };

    @action setIsExecuting = (val: boolean) => {
        this.isExecuting = val;
    };

    onExecuteClicked = async () => {
        if (!this.functionToExecute) {
            return;
        }

        this.setIsExecuting(true);
        try {
            await this.functionToExecute();
        } catch (e) {
            console.log(e);
        }
        const snippet: Snippet = {
            snippetVersion: 1,
            frontendVersion: "v2.0.0",
            tags: ["previous"],
            categories: ["previous", "testing"],
            requires: [],
            code: this.inputString
        };
        this.setIsExecuting(false);
        await SnippetStore.Instance.saveSnippet("_previous", snippet);
    };
}
