import {observer} from "mobx-react";
import * as React from "react";
import {AnchorButton, Dialog, Intent, Tooltip} from "@blueprintjs/core";
import "./URLConnectDialogComponent.css";
import {AppState} from "../../../states/AppState";

@observer
export class URLConnectDialogComponent extends React.Component<{ appState: AppState }, { errMessage: string, url: string }> {
    constructor(props: any) {
        super(props);
        this.state = {errMessage: "", url: ""};
    }

    public render() {
        const appState = this.props.appState;
        return (
            <Dialog
                icon={"folder-open"}
                className="url-connect-dialog"
                backdropClassName="minimal-dialog-backdrop"
                canOutsideClickClose={false}
                lazy={true}
                isOpen={appState.urlConnectDialogVisible}
                onClose={appState.hideURLConnect}
                title="Connect to URL"
            >
                <div className="pt-dialog-body">
                    <input className="pt-input url-connect-input" type="text" placeholder="Remote URL" value={this.state.url} onChange={this.handleInput}/>
                    {this.state.errMessage &&
                    <p>{this.state.errMessage}</p>
                    }
                </div>
                <div className="pt-dialog-footer">
                    <div className="pt-dialog-footer-actions">
                        <AnchorButton intent={Intent.NONE} onClick={appState.hideURLConnect} text="Close"/>
                        <Tooltip content={"Connect to remote server at the given URL"}>
                            <AnchorButton intent={Intent.PRIMARY} onClick={this.onConnectClicked} disabled={!this.validateUrl(this.state.url)} text="Connect"/>
                        </Tooltip>
                    </div>
                </div>
            </Dialog>
        );
    }

    validateUrl = (url) => {
        return url && (url.startsWith("ws://") || url.startsWith("wss://") || url.startsWith("http://") || url.startsWith("https://"));
    };

    handleInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.setState({url: ev.currentTarget.value});
    };

    onConnectClicked = () => {
        const appState = this.props.appState;
        appState.backendService.connect(this.state.url, "1234").subscribe(res => {
            if (res.success) {
                console.log(`Connected with session ID ${res.sessionId}`);
                appState.hideURLConnect();
            }
            else {
                this.setState({errMessage: res.message});
                console.log(res.message);
            }
        }, err => {
            this.setState({errMessage: "Could not connect to remote URL"});
            console.log(err);
        });
    }
}