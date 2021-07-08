import * as React from "react";
import {computed, makeObservable, action} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, InputGroup, Button, Intent, Classes, Dialog, TagInput, FormGroup} from "@blueprintjs/core";
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
        const snippet = SnippetStore.Instance.activeSnippet;
        if (index >= 0 && index < snippet.tags.length) {
            const tagToRemove = snippet.tags[index];
            snippet.tags = snippet.tags.filter(t => t !== tagToRemove);
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
        console.log(_value);
        console.log(index);
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
                    <FormGroup inline={true} label="Name" className="snippet-save-dialog-formgroup">
                        <InputGroup className="snippet-name-input" fill={true} placeholder="Enter snippet name" value={snippetStore.activeSnippetName} autoFocus={true} onChange={this.handleInput} onKeyDown={this.handleKeyDown} />
                    </FormGroup>
                    <FormGroup inline={true} label="Tags" className="snippet-save-dialog-formgroup">
                        <TagInput
                            intent={Intent.PRIMARY}
                            fill={true}
                            placeholder="Enter tags as comma-separated list"
                            addOnBlur={true}
                            tagProps={{minimal: true}}
                            values={snippet.tags.filter(c => c !== "previous")}
                            onAdd={this.handleTagsAdded}
                            onRemove={this.handleTagRemoved}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label="Categories" className="snippet-save-dialog-formgroup">
                        <TagInput
                            intent={Intent.PRIMARY}
                            fill={true}
                            placeholder="Enter categories as comma-separated list"
                            addOnBlur={true}
                            tagProps={{minimal: true}}
                            values={snippet.categories.filter(c => c !== "hidden")}
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
