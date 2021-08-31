import * as React from "react";
import {observer} from "mobx-react";
import {AnchorButton, FormGroup, InputGroup, IDialogProps, Button, Intent, Classes, Text} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore, HelpType} from "stores";
import "./VelocityReferenceDialogComponent.scss"

@observer
export class VelocityReferenceDialogComponent extends React.Component {

    render() {
        const appStore = AppStore.Instance;

        let className = "preference-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "info-sign",
            backdropClassName: "minimal-dialog-backdrop",
            className: className,
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.velocityReferenceDialogVisible,
            onClose: appStore.dialogStore.hideVelocityReferenceDialog,
            title: "Editing Velocity Reference"
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.PLACEHOLDER} defaultWidth={400} defaultHeight={235} enableResizing={true}>
                <div className={Classes.DIALOG_BODY + " freq-input"}>
                    <FormGroup inline={true} label="Source">
                        <Text className="layout-name-input">{appStore.activeFrame?.frameInfo?.fileInfo?.name}</Text>
                    </FormGroup>
                    <FormGroup inline={true} label="Rest frequency">
                        <InputGroup className="layout-name-input" placeholder="" value={""} autoFocus={true} />
                    </FormGroup>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.PRIMARY} text="Save" />
                        <Button
                            intent={Intent.NONE}
                            text="Close"
                            onClick={() => {
                                appStore.dialogStore.hideSaveLayoutDialog();
                            }}
                        />
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}