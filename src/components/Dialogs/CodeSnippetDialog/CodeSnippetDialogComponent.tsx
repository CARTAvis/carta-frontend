import * as React from "react";
import Editor from "react-simple-code-editor";
import {AnchorButton, Classes, DialogProps, Intent} from "@blueprintjs/core";
import classNames from "classnames";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import * as prism from "prismjs";

import {DraggableDialogComponent} from "components/Dialogs";
import {AppToaster, WarningToast} from "components/Shared";
import {Snippet} from "models";
import {AppStore, SnippetStore} from "stores";

import {SaveSnippetDialogComponent} from "./SaveSnippetDialog/SaveSnippetDialogComponent";
import {ThemeProvider} from "./ThemeProvider";

import "./CodeSnippetDialogComponent.scss";

const KEYCODE_ENTER = 13;

@observer
export class CodeSnippetDialogComponent extends React.Component {
    @observable saveDialogOpen: boolean = false;
    private editorRef;

    private static readonly MinWidth = 475;
    private static readonly MinHeight = 300;
    private static readonly DefaultWidth = 700;
    private static readonly DefaultHeight = 400;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @action hideSaveDialog = () => {
        this.saveDialogOpen = false;
        this.tryRefocusEditor();
    };

    @action showSaveDialog = () => {
        this.saveDialogOpen = true;
    };

    private tryRefocusEditor = () => {
        const focusFunction = this.editorRef?._input?.focus;
        if (focusFunction && typeof focusFunction === "function") {
            this.editorRef._input.focus();
        }
    };

    applyHighlight = (code: string) => {
        return prism
            .highlight(code, prism.languages.js, "js")
            .split("\n")
            .map((line, i) => `<span class='editor-line-number'>${i + 1}</span>${line}`)
            .join("\n");
    };

    handleSaveClicked = async (snippetName: string, categories: string[]) => {
        const snippetStore = SnippetStore.Instance;
        const snippet: Snippet = {
            code: snippetStore.activeSnippet?.code,
            categories,
            snippetVersion: Snippet.SnippetVersion,
            frontendVersion: Snippet.FrontendVersion
        };
        const success = await snippetStore.saveSnippet(snippetName, snippet);
        if (success) {
            this.hideSaveDialog();
        }
        snippetStore.setActiveSnippet(snippet, snippetName);
    };

    handleExecuteClicked = async () => {
        const snippetStore = SnippetStore.Instance;

        if (snippetStore.validInput && !snippetStore.isExecuting) {
            const success = await snippetStore.executeCurrentSnippet();
            if (!success) {
                AppToaster.show(WarningToast("Error encountered while executing snippet. See JavaScript console for details."));
            }
        }
        this.tryRefocusEditor();
    };

    handleDeleteClicked = async () => {
        const appStore = AppStore.Instance;
        const confirmed = await appStore.alertStore.showInteractiveAlert("Are you sure you want to delete this snippet?");
        if (confirmed) {
            await appStore.snippetStore.deleteSnippet(appStore.snippetStore.activeSnippetName);
            appStore.snippetStore.clearActiveSnippet();
        }
    };

    handleNewClicked = async () => {
        const appStore = AppStore.Instance;
        const confirmed = await appStore.alertStore.showInteractiveAlert("Are you sure you want to clear the current snippet?");
        if (confirmed) {
            appStore.snippetStore.clearActiveSnippet();
        }
    };

    private handleKeyDown = (ev: React.KeyboardEvent<HTMLElement>) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        // Ctrl/Cmd + Enter executes current code
        if (ev.ctrlKey || ev.metaKey) {
            this.handleExecuteClicked();
        }
    };

    public render() {
        const appStore = AppStore.Instance;
        const snippetStore = appStore.snippetStore;
        const className = classNames("code-snippet-dialog", {"bp5-dark": appStore.darkTheme});

        const dialogProps: DialogProps = {
            icon: "console",
            className: className,
            canEscapeKeyClose: !this.saveDialogOpen,
            canOutsideClickClose: false,
            isOpen: appStore.dialogStore.codeSnippetDialogVisible,
            onClose: appStore.dialogStore.hideCodeSnippetDialog,
            isCloseButtonShown: true,
            title: "Edit Code Snippet"
        };

        const editor = (
            <Editor
                className={"language-js line-numbers"}
                value={snippetStore.activeSnippet?.code}
                onValueChange={snippetStore.setSnippetString}
                onKeyDown={this.handleKeyDown}
                highlight={this.applyHighlight}
                tabSize={4}
                autoFocus={true}
                textareaId="codeArea"
                style={{
                    fontFamily: "'Fira code', 'Fira Mono', monospace",
                    fontSize: 12
                }}
                placeholder="Enter execution string"
                ref={ref => (this.editorRef = ref)}
            />
        );

        return (
            <DraggableDialogComponent
                dialogProps={dialogProps}
                minWidth={CodeSnippetDialogComponent.MinWidth}
                minHeight={CodeSnippetDialogComponent.MinHeight}
                defaultWidth={CodeSnippetDialogComponent.DefaultWidth}
                defaultHeight={CodeSnippetDialogComponent.DefaultHeight}
                enableResizing={true}
            >
                <div className={Classes.DIALOG_BODY}>
                    <ThemeProvider darkTheme={appStore.darkTheme} children={editor} />
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton icon="play" intent={Intent.SUCCESS} onClick={this.handleExecuteClicked} disabled={!snippetStore.validInput || snippetStore.isExecuting} text="Execute" />
                    </div>
                    <div className="spacer" />
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton icon="add" intent={Intent.SUCCESS} onClick={this.handleNewClicked} disabled={snippetStore.isExecuting} text="New" />
                        <AnchorButton icon="trash" intent={Intent.WARNING} onClick={this.handleDeleteClicked} disabled={snippetStore.isExecuting || !snippetStore.activeSnippetName} text="Delete" />
                        <AnchorButton icon="floppy-disk" intent={Intent.PRIMARY} onClick={this.showSaveDialog} disabled={snippetStore.isExecuting} text="Save" />
                    </div>
                </div>
                <SaveSnippetDialogComponent onSaveClicked={this.handleSaveClicked} onCancelClicked={this.hideSaveDialog} isOpen={this.saveDialogOpen} />
            </DraggableDialogComponent>
        );
    }
}
