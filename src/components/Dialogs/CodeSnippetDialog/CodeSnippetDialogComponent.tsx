import * as React from "react";
import * as prism from "prismjs";
import {observer} from "mobx-react";
import {AnchorButton, Classes, IDialogProps, Intent} from "@blueprintjs/core";
import Editor from "react-simple-code-editor";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppToaster, WarningToast} from "components/Shared";
import {AppStore, SnippetStore} from "stores";

import "prismjs/themes/prism.css";
import "./CodeSnippetDialogComponent.scss";

@observer
export class CodeSnippetDialogComponent extends React.Component {
    public render() {
        const appStore = AppStore.Instance;
        const snippetStore = appStore.snippetStore;
        let className = "debug-execution-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "console",
            className: className,
            canEscapeKeyClose: true,
            canOutsideClickClose: false,
            isOpen: appStore.dialogStore.codeSnippetDialogVisible,
            onClose: appStore.dialogStore.hideCodeSnippetDialog,
            isCloseButtonShown: true,
            title: "Edit code snippet"
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={700} defaultHeight={400} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <Editor
                        className={"language-js line-numbers"}
                        value={snippetStore.activeSnippetString}
                        onValueChange={snippetStore.setSnippetString}
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
                        <AnchorButton intent={Intent.PRIMARY} onClick={this.onExecuteClicked} disabled={!snippetStore.validInput || snippetStore.isExecuting} text="Execute" />
                        <AnchorButton intent={Intent.NONE} onClick={appStore.dialogStore.hideCodeSnippetDialog} text="Close" />
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

    onExecuteClicked = async () => {
        const snippetStore = SnippetStore.Instance;

        if (!snippetStore.validInput) {
            return;
        }

        const success = await snippetStore.executeCurrentSnippet();
        if (!success) {
            AppToaster.show(WarningToast("Error encountered while executing snippet. See JavaScript console for details."));
        }
    };
}
