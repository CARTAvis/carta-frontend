import * as React from "react";
import {AnchorButton, Checkbox, Classes, Dialog, DialogProps, InputGroup, Intent} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {observer} from "mobx-react";

import {AppStore} from "stores";
import {copyToClipboard} from "utilities";

import {AppToaster, WarningToast} from "../../Shared";

import "./ShareWorkspaceDialogComponent.scss";

export const ShareWorkspaceDialogComponent = observer(() => {
    const [shareKey, setShareKey] = React.useState<string>("");
    const [isGeneratingLink, setIsGeneratingLink] = React.useState<boolean>(false);
    const [saveBeforeShare, setSaveBeforeShare] = React.useState<boolean>(false);

    const appStore = AppStore.Instance;
    const {shareWorkspaceDialogVisible, hideShareWorkspaceDialog} = appStore.dialogStore;
    const {activeWorkspace} = appStore;

    const dialogProps: DialogProps = {
        icon: "share",
        className: "share-workspace-dialog",
        canOutsideClickClose: true,
        lazy: true,
        canEscapeKeyClose: true,
        isOpen: shareWorkspaceDialogVisible,
        onClose: hideShareWorkspaceDialog,
        title: `Share Workspace: ${activeWorkspace?.name ?? ""}`
    };

    const handleGenerateClicked = async () => {
        if (!activeWorkspace?.id) {
            return;
        }

        setIsGeneratingLink(true);

        try {
            if (activeWorkspace.name && saveBeforeShare) {
                await appStore.saveWorkspace(activeWorkspace.name);
            }
            const shareKey = await appStore.apiService.getSharedWorkspaceKey(activeWorkspace.id);
            setShareKey(shareKey);
        } catch (err) {
            console.log(err);
            AppToaster.show(WarningToast("Could not generate a sharing link."));
        }
    };

    let footer: React.ReactNode;

    if (shareKey) {
        const baseUrl = window.location.href.split("?")[0];
        const link = `${baseUrl}?key=${shareKey}`;
        const copyButton = (
            <Tooltip2>
                <AnchorButton intent={Intent.SUCCESS} minimal={true} icon="clipboard" onClick={() => copyToClipboard(link)} />
            </Tooltip2>
        );
        footer = (
            <>
                <InputGroup fill={true} intent={Intent.SUCCESS} readOnly={true} defaultValue={link} rightElement={copyButton} />
            </>
        );
    } else {
        footer = (
            <>
                <Checkbox label="Save workspace before sharing" disabled={!activeWorkspace?.editable || !activeWorkspace.name} checked={saveBeforeShare} onChange={() => setSaveBeforeShare(!saveBeforeShare)} />
                <AnchorButton disabled={isGeneratingLink} intent={Intent.PRIMARY} text="Generate link" onClick={handleGenerateClicked} />
            </>
        );
    }

    return (
        <Dialog {...dialogProps}>
            <div className={Classes.DIALOG_BODY}>
                <p>
                    This workspace will be marked as shared, and a shareable link will be generated. Please note that this does not automatically grant other users access to files in the workplace. Please contact your system administrator
                    to adjust file permissions.
                </p>
            </div>
            <div className={Classes.DIALOG_FOOTER}>
                <div className={Classes.DIALOG_FOOTER_ACTIONS}>{footer}</div>
            </div>
        </Dialog>
    );
});
