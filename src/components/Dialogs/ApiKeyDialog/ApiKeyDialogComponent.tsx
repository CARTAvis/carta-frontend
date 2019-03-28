import * as React from "react";
import {observer} from "mobx-react";
import {AnchorButton, Classes, IDialogProps, Intent, Tooltip} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore} from "stores";
import "./ApiKeyDialogComponent.css";
import {observable} from "mobx";

@observer
export class ApiKeyDialogComponent extends React.Component<{ appStore: AppStore }> {
    @observable key;

    constructor(props: any) {
        super(props);
        this.key = this.props.appStore.apiKey;
    }

    public render() {
        const appStore = this.props.appStore;
        let className = "url-connect-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "key",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: true,
            lazy: true,
            isOpen: appStore.apiKeyDialogVisible,
            onClose: appStore.hideApiKeyDialog,
            title: "Edit API Key",
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={400} defaultHeight={160} enableResizing={false}>
                <div className={Classes.DIALOG_BODY}>
                    <input className="bp3-input url-connect-input" type="text" placeholder="API Key" value={this.key} onChange={this.handleInput}/>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.NONE} onClick={appStore.hideApiKeyDialog} text="Close"/>
                        <AnchorButton intent={Intent.NONE} onClick={() => this.key = ""} disabled={!this.key} text="Clear"/>
                        <AnchorButton intent={Intent.PRIMARY} onClick={this.onApplyKeyClicked} disabled={this.key === this.props.appStore.apiKey} text="Apply (Reload required)"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }

    handleInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.key = ev.currentTarget.value;
    };

    onApplyKeyClicked = () => {
        const appStore = this.props.appStore;
        appStore.applyApiKey(this.key);
    };
}