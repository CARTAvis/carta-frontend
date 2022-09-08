import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import {AnchorButton, Classes, Dialog} from "@blueprintjs/core";
import {AppStore} from "stores";

interface ConfirmationDialogComponentProps {
    isOpen: boolean;
    cancellable: boolean;
    onConfirm: (overwrite: boolean) => () => void;
    onCancel?: () => void;
    titleText: string;
    contentText?: string;
}

@observer
export class ConfirmationDialogComponent extends React.Component<ConfirmationDialogComponentProps> {
    render() {
        const titleText = this.props.titleText;
        const className = classNames("confirmation-dialog", {"bp3-dark": AppStore.Instance.darkTheme});

        return (
            <Dialog portalClassName="dialog-portal" className={className} icon={"warning-sign"} canEscapeKeyClose={false} canOutsideClickClose={false} isCloseButtonShown={false} title={titleText} isOpen={this.props.isOpen}>
                <div className={Classes.DIALOG_BODY}>
                    <>{this.props.contentText}</>
                </div>
                {this.props.cancellable && (
                    <div className={Classes.DIALOG_FOOTER}>
                        <div className="footer-button">
                            <AnchorButton onClick={this.props.onConfirm(true)}>Yes</AnchorButton>
                            <AnchorButton onClick={this.props.onConfirm(false)}>No</AnchorButton>
                            <AnchorButton onClick={this.props.onCancel}>Cancel</AnchorButton>
                        </div>
                    </div>
                )}
            </Dialog>
        );
    }
}
