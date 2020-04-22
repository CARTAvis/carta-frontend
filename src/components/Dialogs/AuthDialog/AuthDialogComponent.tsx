import * as React from "react";
import {observer} from "mobx-react";
import {computed, observable} from "mobx";
import {AnchorButton, Classes, Dialog, FormGroup, InputGroup, Intent} from "@blueprintjs/core";
import {AppStore, DialogStore} from "stores";
import "./AuthDialogComponent.css";

const KEYCODE_ENTER = 13;

@observer
export class AuthDialogComponent extends React.Component {
    @observable username: string = "";
    @observable password: string = "";
    @observable isAuthenticating: boolean;
    @observable errorString: string;

    @computed get signInEnabled() {
        return this.username && this.password && !this.isAuthenticating;
    }

    public render() {
        const appStore = AppStore.Instance;
        let className = "auth-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        return (
            <Dialog icon="key" className={className} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={appStore.dialogStore.authDialogVisible} isCloseButtonShown={false} title="Sign In">
                <div className={Classes.DIALOG_BODY}>
                    <FormGroup helperText={this.errorString} intent={this.errorString ? "danger" : "none"}>
                        <InputGroup placeholder="Username" value={this.username} onChange={this.handleUsernameInput} onKeyDown={this.handleKeyDown} autoFocus={true}/>
                        <InputGroup placeholder="Password" value={this.password} onChange={this.handlePasswordInput} onKeyDown={this.handleKeyDown} type="password"/>
                    </FormGroup>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.PRIMARY} onClick={this.onSignInClicked} disabled={!this.signInEnabled} text="Sign In"/>
                    </div>
                </div>
            </Dialog>
        );
    }

    private handleKeyDown = (ev) => {
        if (ev.keyCode === KEYCODE_ENTER && this.signInEnabled) {
            this.onSignInClicked();
        }
    };

    handleUsernameInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.username = ev.currentTarget.value;
    };

    handlePasswordInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.password = ev.currentTarget.value;
    };

    onSignInClicked = () => {
        this.isAuthenticating = true;
        const appStore = AppStore.Instance;
        appStore.backendService.authenticate(this.username, this.password).then(res => {
            this.isAuthenticating = false;
            if (res.ok) {
                res.json().then(responseData => {
                    if (responseData && responseData.username && responseData.token && responseData.socket) {
                        // Add delay to allow backend server to start listening
                        setTimeout(() => {
                            appStore.backendService.setAuthToken(responseData.token);
                            appStore.setUsername(responseData.username);
                            appStore.connectToServer(responseData.socket);
                            appStore.dialogStore.hideAuthDialog();
                        }, 50);
                    }
                }, parseError => {
                    this.errorString = "Problem parsing server response";
                    console.error(parseError);
                });
            } else {
                if (res.status === 403) {
                    this.errorString = "Invalid user/password combination";
                } else {
                    this.errorString = `Authentication error: ${res.status}: ${res.statusText}`;
                }
            }
        }, err => {
            this.errorString = "Failed to connect to authentication service";
            this.isAuthenticating = false;
        });
    };
}