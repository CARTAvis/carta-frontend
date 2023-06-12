import * as React from "react";
import {AnchorButton, Button, Classes, Dialog, FormGroup, InputGroup, Intent, TagInput} from "@blueprintjs/core";
import classNames from "classnames";
import {action, computed, makeObservable} from "mobx";
import {observer} from "mobx-react";

import {AlertStore, AppStore, SnippetStore} from "stores";

import "./SaveSnippetDialogComponent.scss";

const KEYCODE_ENTER = 13;

interface SaveSnippetDialogProps {
    onSaveClicked: (layoutName: string, categories: string[]) => void;
    onCancelClicked: () => void;
    isOpen: boolean;
}

@observer
export class SaveSnippetDialogComponent extends React.Component<SaveSnippetDialogProps> {
    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @action private handleInput = (ev: React.FormEvent<HTMLInputElement>) => {
        SnippetStore.Instance.activeSnippetName = ev.currentTarget.value;
    };

    @action private handleCategoriesAdded = (newCategories?: string[]) => {
        if (newCategories) {
            const existingCategories = SnippetStore.Instance.activeSnippet.categories;
            for (const category of newCategories) {
                if (!existingCategories.includes(category)) {
                    existingCategories.push(category);
                }
            }
        }
    };

    @action private handleCategoryRemoved = (_value, index) => {
        const snippet = SnippetStore.Instance.activeSnippet;
        if (index >= 0 && index < snippet.categories.length) {
            const categoryToRemove = snippet.categories[index];
            snippet.categories = snippet.categories.filter(t => t !== categoryToRemove);
        }
    };

    private handleKeyDown = ev => {
        if (ev.keyCode === KEYCODE_ENTER && SnippetStore.Instance.activeSnippetName?.length) {
            this.saveSnippet();
        }
    };

    @computed get validInput() {
        const snippetStore = SnippetStore.Instance;
        return snippetStore.activeSnippetName?.length > 0 && snippetStore.activeSnippet?.categories;
    }

    saveSnippet = async () => {
        const snippetStore = SnippetStore.Instance;

        if (snippetStore.snippets.has(snippetStore.activeSnippetName)) {
            const confirmed = await AlertStore.Instance.showInteractiveAlert(`Are you sure to overwrite the existing snippet ${snippetStore.activeSnippetName}?`);
            if (!confirmed) {
                return;
            }
        }
        this.props.onSaveClicked(snippetStore.activeSnippetName, snippetStore.activeSnippet.categories);
    };

    render() {
        const appStore = AppStore.Instance;
        const snippetStore = appStore.snippetStore;
        const snippet = snippetStore.activeSnippet;
        const className = classNames("snippet-save-dialog", {"bp3-dark": appStore.darkTheme});

        return (
            <Dialog
                icon="console"
                backdropClassName="minimal-dialog-backdrop"
                className={className}
                canOutsideClickClose={false}
                isOpen={this.props.isOpen}
                onClose={this.props.onCancelClicked}
                canEscapeKeyClose={true}
                portalClassName="save-dialog-portal"
                title="Save Code Snippet"
            >
                <div className={Classes.DIALOG_BODY}>
                    <FormGroup inline={true} label="Name" className="snippet-save-dialog-formgroup">
                        <InputGroup className="snippet-name-input" fill={true} placeholder="Enter snippet name" value={snippetStore.activeSnippetName} autoFocus={true} onChange={this.handleInput} onKeyDown={this.handleKeyDown} />
                    </FormGroup>
                    <FormGroup inline={true} label="Categories" className="snippet-save-dialog-formgroup">
                        <TagInput
                            intent={Intent.PRIMARY}
                            fill={true}
                            placeholder="Enter categories as comma-separated list"
                            addOnBlur={true}
                            tagProps={{minimal: true}}
                            values={snippet.categories}
                            onAdd={this.handleCategoriesAdded}
                            onRemove={this.handleCategoryRemoved}
                        />
                    </FormGroup>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.PRIMARY} onClick={this.saveSnippet} text="Save" disabled={!this.validInput} />
                        <Button intent={Intent.NONE} text="Close" onClick={this.props.onCancelClicked} />
                    </div>
                </div>
            </Dialog>
        );
    }
}
