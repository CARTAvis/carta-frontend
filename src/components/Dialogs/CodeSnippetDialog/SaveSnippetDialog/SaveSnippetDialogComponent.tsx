import * as React from "react";
import {computed, makeObservable, action} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, InputGroup, Button, Intent, Classes, Dialog, TagInput} from "@blueprintjs/core";
import {AlertStore, AppStore, SnippetStore} from "stores";
import "./SaveSnippetDialogComponent.scss";

const KEYCODE_ENTER = 13;

interface SaveSnippetDialogProps {
    onSaveClicked: (layoutName: string, categories: string[], tags: string[]) => void;
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

    @action private handleTagsAdded = (newTags?: string[]) => {
        if (newTags) {
            const existingTags = SnippetStore.Instance.activeSnippet.tags;
            for (const tag of newTags) {
                if (!existingTags.includes(tag)) {
                    existingTags.push(tag);
                }
            }
        }
    };

    @action private handleTagRemoved = (_value, index) => {
        const existingTags = SnippetStore.Instance.activeSnippet.tags;
        if (index >= 0 && index < existingTags.length) {
            const tagToRemove = existingTags[index];
            SnippetStore.Instance.activeSnippet.tags = existingTags.filter(t => t !== tagToRemove);
        }
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
        const existingCategories = SnippetStore.Instance.activeSnippet.categories;
        if (index >= 0 && index < existingCategories) {
            const categoryToRemove = existingCategories[index];
            SnippetStore.Instance.activeSnippet.categories = existingCategories.filter(t => t !== categoryToRemove);
        }
    };

    private handleKeyDown = ev => {
        if (ev.keyCode === KEYCODE_ENTER && SnippetStore.Instance.activeSnippetName?.length) {
            this.saveSnippet();
        }
    };

    @computed get validInput() {
        const snippetStore = SnippetStore.Instance;
        return snippetStore.activeSnippetName?.length > 0 && snippetStore.activeSnippet?.tags && snippetStore.activeSnippet?.categories;
    }

    saveSnippet = async () => {
        const snippetStore = SnippetStore.Instance;

        if (snippetStore.snippets.has(snippetStore.activeSnippetName)) {
            const confirmed = await AlertStore.Instance.showInteractiveAlert(`Are you sure to overwrite the existing snippet ${snippetStore.activeSnippetName}?`);
            if (!confirmed) {
                return;
            }
        }
        this.props.onSaveClicked(snippetStore.activeSnippetName, snippetStore.activeSnippet.categories, snippetStore.activeSnippet.tags);
    };

    render() {
        const appStore = AppStore.Instance;
        const snippetStore = appStore.snippetStore;
        const snippet = snippetStore.activeSnippet;
        let className = "preference-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        return (
            <Dialog
                icon="console"
                backdropClassName="minimal-dialog-backdrop"
                className={className}
                canOutsideClickClose={false}
                isOpen={this.props.isOpen}
                onClose={this.props.onCancelClicked}
                canEscapeKeyClose={true}
                title="Save Code Snippet"
            >
                <div className={Classes.DIALOG_BODY}>
                    <InputGroup className="snippet-name-input" placeholder="Enter snippet name" value={snippetStore.activeSnippetName} autoFocus={true} onChange={this.handleInput} onKeyDown={this.handleKeyDown} />
                    <TagInput intent={Intent.PRIMARY} placeholder="Enter tags as comma-separated list" addOnBlur={true} tagProps={{minimal: true}} values={snippet.tags} onAdd={this.handleTagsAdded} onRemove={this.handleTagRemoved} />
                    <TagInput
                        intent={Intent.PRIMARY}
                        placeholder="Enter categories as comma-separated list"
                        addOnBlur={true}
                        tagProps={{minimal: true}}
                        values={snippet.categories}
                        onAdd={this.handleCategoriesAdded}
                        onRemove={this.handleCategoryRemoved}
                    />
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
