import * as React from "react";
import {observer} from "mobx-react";
import {observable} from "mobx";
import {AnchorButton, Classes, FormGroup, IDialogProps, InputGroup, Intent, Tooltip} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore} from "stores";
import "./URLConnectDialogComponent.css";

const KEYCODE_ENTER = 13;

@observer
export class URLConnectDialogComponent extends React.Component<{ appStore: AppStore }, { errMessage: string, url: string }> {
    @observable errMessage: string = "";
    @observable url: string = "";

    private static readonly URL_TEST_REGEX = new RegExp(/(ws(s)?):\/\/\S+/);

    private validateUrl = (url) => {
        return url && URLConnectDialogComponent.URL_TEST_REGEX.test(url);
    };

    private handleInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.url = ev.currentTarget.value;
    };

    private handleKeyDown = (ev) => {
        if (ev.keyCode === KEYCODE_ENTER && this.validateUrl(this.url)) {
            this.onConnectClicked();
        }
    };

    private onConnectClicked = () => {
        const appStore = this.props.appStore;
        appStore.backendService.connect(this.url, appStore.apiKey, false).subscribe(sessionId => {
            console.log(`Connected with session ID ${sessionId}`);
            this.errMessage = "";
            appStore.hideURLConnect();
        }, err => {
            this.errMessage = "Could not connect to remote URL";
            console.log(err);
        });
    };

    public render() {
        const appStore = this.props.appStore;
        let className = "url-connect-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "swap-vertical",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.urlConnectDialogVisible,
            onClose: appStore.hideURLConnect,
            title: "Connect to remote server",
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={360} defaultHeight={210} enableResizing={false}>
                <div className={Classes.DIALOG_BODY}>
                    <FormGroup label="Remote URL" inline={true}>
                        <InputGroup placeholder="Enter WebSocket URL" value={this.url} onChange={this.handleInput} onKeyDown={this.handleKeyDown} autoFocus={true}/>
                    </FormGroup>
                    {this.errMessage &&
                    <p>{this.errMessage}</p>
                    }
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.NONE} onClick={appStore.hideURLConnect} text="Close"/>
                        <Tooltip content={"Connect to remote server at the given URL"}>
                            <AnchorButton intent={Intent.PRIMARY} onClick={this.onConnectClicked} disabled={!this.validateUrl(this.url)} text="Connect"/>
                        </Tooltip>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}