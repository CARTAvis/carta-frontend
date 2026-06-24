import * as React from "react";
import {Classes, type DialogProps} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs/DraggableDialog/DraggableDialogComponent";
import {AppStore} from "stores";
import {CustomUIStore} from "stores/CustomUI/CustomUIStore";
import {DialogStore} from "stores/DialogStore/DialogStore";

import {CustomUIContent} from "./CustomUIContent";

@observer
export class CustomDialogComponent extends React.Component {
    render() {
        const customUIStore = CustomUIStore.Instance;
        const dialogStore = DialogStore.Instance;
        const isDark = AppStore.Instance.isDarkTheme;

        const openDialogs = Array.from(customUIStore.definitions.values()).filter(def => def.surface === "dialog" && (dialogStore.dialogVisible.get(def.id) ?? false));

        return (
            <React.Fragment>
                {openDialogs.map(def => {
                    const dialogProps: DialogProps = {
                        isOpen: true,
                        title: def.title ?? "Custom",
                        canEscapeKeyClose: true,
                        canOutsideClickClose: false,
                        className: classNames("custom-ui-dialog", {[Classes.DARK]: isDark})
                    };
                    return (
                        <DraggableDialogComponent key={def.id} dialogId={def.id} dialogProps={dialogProps} defaultWidth={def.width ?? 450} defaultHeight={def.height ?? 350} minWidth={200} minHeight={150} isResizingEnabled={true}>
                            <div className={Classes.DIALOG_BODY}>
                                <CustomUIContent id={def.id} />
                            </div>
                        </DraggableDialogComponent>
                    );
                })}
            </React.Fragment>
        );
    }
}
