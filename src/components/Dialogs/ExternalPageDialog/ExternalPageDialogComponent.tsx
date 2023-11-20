import * as React from "react";
import Iframe from "react-iframe";
import {IDialogProps} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore} from "stores";
import {findzIndex, updateFloatingObjzIndexOnRemove, updateSelectFloatingObjzIndex} from "utilities";

import "./ExternalPageDialogComponent.scss";

@observer
export class ExternalPageDialogComponent extends React.Component {
    public static DialogId = "externalPage-dialog";

    render() {
        const appStore = AppStore.Instance;
        const className = classNames("iframe-dialog", {"bp3-dark": appStore.darkTheme});

        let zIndex = findzIndex(ExternalPageDialogComponent.DialogId);

        const dialogProps: IDialogProps = {
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
            <DraggableDialogComponent
                dialogProps={dialogProps}
                minWidth={400}
                minHeight={400}
                defaultWidth={800}
                defaultHeight={600}
                enableResizing={true}
                zIndex={zIndex}
                onSelected={() => updateSelectFloatingObjzIndex(ExternalPageDialogComponent.DialogId)}
                onClosed={() => updateFloatingObjzIndexOnRemove(zIndex)}
            >
                <div className="bp3-dialog-body">
                    <Iframe url={appStore.dialogStore.externalPageDialogUrl} />
                </div>
            </DraggableDialogComponent>
        );
    }
}
