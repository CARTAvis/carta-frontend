import * as React from "react";
import {AnchorButton, Classes, type DialogProps, Intent, NonIdealState, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {getRegionIconOpacity, ScrollShadow} from "components/Shared";
import {DialogId, HelpType, RegionOpacity} from "enums";
import {AppStore} from "stores";
import {type RegionStore} from "stores/Frame";

import {AppearanceForm} from "../RegionDialog/AppearanceForm/AppearanceForm";

import "./GroupRegionDialogComponent.scss";

@observer
export class GroupRegionDialogComponent extends React.Component {
    private static readonly MissingRegionNode = (<NonIdealState icon={"folder-open"} title={"No regions selected"} description={"Select multiple regions using the region list or image view"} />);

    private static readonly DefaultWidth = 525;
    private static readonly DefaultHeight = 575;
    private static readonly MinWidth = 450;
    private static readonly MinHeight = 300;

    private applyToSelected = (handler: (region: RegionStore) => void) => {
        const selectedRegions = AppStore.Instance.activeFrame?.regionSet.selectedRegionsList ?? [];
        selectedRegions.forEach(handler);
    };

    private handleLockClicked = () => {
        AppStore.Instance.activeFrame?.regionSet.toggleSelectedRegionsLocked();
    };

    private handleDeleteClicked = () => {
        const appStore = AppStore.Instance;
        appStore.deleteSelectedRegions();
        appStore.dialogStore.hideDialog(DialogId.GroupRegion);
    };

    private handleHideClicked = () => {
        AppStore.Instance.activeFrame?.regionSet.toggleSelectedRegionsVisibility();
    };

    private handleExportClicked = () => {
        AppStore.Instance.fileBrowserStore.showExportSelectedRegions();
    };

    public render() {
        const appStore = AppStore.Instance;
        const className = classNames("group-region-dialog", {[Classes.DARK]: appStore.darkTheme});
        const activeFrame = appStore.activeFrame;
        const regionSet = activeFrame?.regionSet;
        const focusedRegion = regionSet?.focusedRegion;
        const selectedRegions = regionSet?.selectedRegionsList ?? [];
        const selectedRegionsOpacity = regionSet?.selectedRegionsOpacity ?? RegionOpacity.Invisible;
        const selectedRegionsVisible = selectedRegionsOpacity !== RegionOpacity.Invisible;
        const lockDisabled = !!regionSet?.locked || selectedRegionsOpacity === RegionOpacity.Invisible;
        const showLockedIcon = lockDisabled || (regionSet?.selectedRegionsAllLocked ?? false);
        const deleteDisabled = !!regionSet?.locked || selectedRegions.every(region => region.locked);

        const dialogProps: DialogProps = {
            icon: "info-sign",
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: true,
            lazy: true,
            isOpen: appStore.dialogStore.dialogVisible.get(DialogId.GroupRegion) ?? false,
            className,
            canEscapeKeyClose: true,
            title: "No regions selected"
        };

        let bodyContent = GroupRegionDialogComponent.MissingRegionNode;
        if (activeFrame && focusedRegion && selectedRegions.length > 1) {
            dialogProps.title = `Editing ${selectedRegions.length} Regions (${activeFrame.filename})`;
            bodyContent = <AppearanceForm region={focusedRegion} darkTheme={appStore.darkTheme} applyToTargets={this.applyToSelected} visibleControls={AppearanceForm.getCommonControls(selectedRegions)} />;
        }

        return (
            <DraggableDialogComponent
                dialogProps={dialogProps}
                helpType={HelpType.REGION_DIALOG}
                defaultWidth={GroupRegionDialogComponent.DefaultWidth}
                defaultHeight={GroupRegionDialogComponent.DefaultHeight}
                minHeight={GroupRegionDialogComponent.MinHeight}
                minWidth={GroupRegionDialogComponent.MinWidth}
                enableResizing={true}
                dialogId={DialogId.GroupRegion}
            >
                <div className={Classes.DIALOG_BODY}>
                    <ScrollShadow>{bodyContent}</ScrollShadow>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        {activeFrame && focusedRegion && selectedRegions.length > 1 && (
                            <>
                                <Tooltip content={showLockedIcon ? "Unlock selected regions" : "Lock selected regions"}>
                                    <AnchorButton intent={Intent.WARNING} minimal={true} icon={showLockedIcon ? "lock" : "unlock"} onClick={this.handleLockClicked} disabled={lockDisabled} />
                                </Tooltip>
                                <Tooltip content={selectedRegionsVisible ? "Hide selected regions" : "Show selected regions"}>
                                    <AnchorButton
                                        intent={Intent.WARNING}
                                        minimal={true}
                                        icon={selectedRegionsVisible ? "eye-open" : "eye-off"}
                                        onClick={this.handleHideClicked}
                                        style={{opacity: getRegionIconOpacity(selectedRegionsOpacity)}}
                                    />
                                </Tooltip>
                                <Tooltip content="Export selected regions">
                                    <AnchorButton intent={Intent.WARNING} minimal={true} icon="cloud-upload" onClick={this.handleExportClicked} />
                                </Tooltip>
                                <AnchorButton intent={Intent.DANGER} icon="trash" text="Delete" onClick={this.handleDeleteClicked} disabled={deleteDisabled} style={{userSelect: "none"}} />
                            </>
                        )}
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
