import * as React from "react";
import Iframe from "react-iframe";
import {DialogProps} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore} from "stores";

import "./ExternalPageDialogComponent.scss";

@observer
export class ExternalPageDialogComponent extends React.Component {
    render() {
        const appStore = AppStore.Instance;
        const className = classNames("iframe-dialog", {"bp4-dark": appStore.darkTheme});

        const dialogProps: DialogProps = {
            icon: "info-sign",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.externalPageDialogVisible,
            onClose: appStore.dialogStore.hideExternalPageDialog,
            title: appStore.dialogStore.externalPageDialogTitle
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={400} minHeight={400} defaultWidth={800} defaultHeight={600} enableResizing={true}>
                <div className="bp4-dialog-body">
                    <Iframe url={appStore.dialogStore.externalPageDialogUrl} />
                </div>
            </DraggableDialogComponent>
        );
    }
}
