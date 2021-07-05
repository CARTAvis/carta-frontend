import * as React from "react";
import {observable, computed, makeObservable, action} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, InputGroup, Button, Intent, Classes, Dialog, TagInput} from "@blueprintjs/core";
import {AppStore} from "stores";
import "./SaveSnippetDialogComponent.scss";

const KEYCODE_ENTER = 13;

interface SaveSnippetDialogProps {
    onSaveClicked: (layoutName: string, categories: string[], tags: string[]) => void;
    onCancelClicked: () => void;
    isOpen: boolean;
}

@observer
export class SaveSnippetDialogComponent extends React.Component<SaveSnippetDialogProps> {
    @observable private snippetName: string = "";
    @observable private tags: string[] = [];
    @observable private categories: string[] = [];

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @action private handleInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.snippetName = ev.currentTarget.value;
    };

    @action private handleTagsAdded = (newTags?: string[]) => {
        if (newTags) {
            for (const tag of newTags) {
                if (!this.tags.includes(tag)) {
                    this.tags.push(tag);
                }
            }
        }
    };

    @action private handleTagsRemoved = (_value, index) => {
        if (index >= 0 && index < this.tags.length) {
            const tagToRemove = this.tags[index];
            this.tags = this.tags.filter(t => t !== tagToRemove);
        }
    };

    private handleKeyDown = ev => {
        if (ev.keyCode === KEYCODE_ENTER && this.snippetName?.length) {
            this.saveSnippet();
        }
    };

    @computed get validInput() {
        return this.snippetName?.length > 0 && this.tags && this.categories;
    }

    @action saveSnippet = () => {
        //TODO: check for overwrites
        this.props.onSaveClicked(this.snippetName, this.categories, this.tags);
    };

    render() {
        const appStore = AppStore.Instance;

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
                    <InputGroup className="snippet-name-input" placeholder="Enter snippet name" value={this.snippetName} autoFocus={true} onChange={this.handleInput} onKeyDown={this.handleKeyDown} />
                    <TagInput intent={"primary"} placeholder="Enter tags as comma-separated list" addOnBlur={true} tagProps={{minimal: true}} values={this.tags} onAdd={this.handleTagsAdded} onRemove={this.handleTagsRemoved} />
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
