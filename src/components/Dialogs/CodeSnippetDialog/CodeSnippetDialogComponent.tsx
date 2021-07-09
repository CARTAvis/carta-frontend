import * as React from "react";
import * as prism from "prismjs";
import {observer} from "mobx-react";
import {action, makeObservable, observable} from "mobx";
import {AnchorButton, Classes, IDialogProps, Intent} from "@blueprintjs/core";
import Editor from "react-simple-code-editor";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppToaster, WarningToast} from "components/Shared";
import {SaveSnippetDialogComponent} from "./SaveSnippetDialog/SaveSnippetDialogComponent";
import {AppStore, SnippetStore} from "stores";
import {Snippet} from "models";
import {ThemeProvider} from "./ThemeProvider";
import "./CodeSnippetDialogComponent.scss";

@observer
export class CodeSnippetDialogComponent extends React.Component {
    @observable saveDialogOpen: boolean = false;
    private editorRef;

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

    handleSaveClicked = async (snippetName: string, categories: string[], tags: []) => {
        console.log({snippetName, categories, tags});
        const snippetStore = SnippetStore.Instance;
        const snippet: Snippet = {
            code: snippetStore.activeSnippet?.code,
            categories,
            tags,
            snippetVersion: Snippet.SnippetVersion,
            frontendVersion: Snippet.FrontendVersion
        };
        const success = await snippetStore.saveSnippet(snippetName, snippet);
        if (success) {
            this.hideSaveDialog();
        }
        snippetStore.setActiveSnippet(snippet, snippetName);
    };

    private tryRefocusEditor = () => {
        const focusFunction = this.editorRef?._input?.focus;
        if (focusFunction && typeof focusFunction === "function") {
            this.editorRef._input.focus();
        }
    };

    public render() {
        const appStore = AppStore.Instance;
        const snippetStore = appStore.snippetStore;
        let className = "code-snippet-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "console",
            className: className,
            canEscapeKeyClose: !this.saveDialogOpen,
            canOutsideClickClose: false,
            isOpen: appStore.dialogStore.codeSnippetDialogVisible,
            onClose: appStore.dialogStore.hideCodeSnippetDialog,
            isCloseButtonShown: true,
            title: "Edit code snippet"
        };

        const editor = (
            <Editor
                className={"language-js line-numbers"}
                value={snippetStore.activeSnippet?.code}
                onValueChange={snippetStore.setSnippetString}
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
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={700} defaultHeight={400} enableResizing={true}>
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
                        <AnchorButton intent={Intent.NONE} onClick={appStore.dialogStore.hideCodeSnippetDialog} text="Close" />
                    </div>
                </div>
                <SaveSnippetDialogComponent onSaveClicked={this.handleSaveClicked} onCancelClicked={this.hideSaveDialog} isOpen={this.saveDialogOpen} />
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

    handleExecuteClicked = async () => {
        const snippetStore = SnippetStore.Instance;

        if (snippetStore.validInput) {
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

    handleNewClicked = () => {
        SnippetStore.Instance.clearActiveSnippet();
    };
}
