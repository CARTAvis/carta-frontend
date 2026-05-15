import * as React from "react";
import {AnchorButton, Classes, type DialogProps, Intent, NonIdealState, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {ScrollShadow} from "components/Shared";
import {DialogId, HelpType} from "enums";
import {AppStore} from "stores";
import {type CompassAnnotationStore, type PointAnnotationStore, type RegionStore, type RulerAnnotationStore, type TextAnnotationStore, type VectorAnnotationStore} from "stores/Frame";

import {AppearanceForm, type AppearanceFormHandlers} from "../RegionDialog/AppearanceForm/AppearanceForm";

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

    private applyByType = (type: CARTA.RegionType, handler: (region: RegionStore) => void) => {
        this.applyToSelected(region => {
            if (region.regionType === type) {
                handler(region);
            }
        });
    };

    private handleLockClicked = () => {
        AppStore.Instance.activeFrame?.regionSet.toggleSelectedRegionsLocked();
    };

    private handleDeleteClicked = () => {
        const appStore = AppStore.Instance;
        appStore.deleteSelectedRegion();
        appStore.dialogStore.hideDialog(DialogId.GroupRegion);
    };

    private handleHideClicked = () => {
        AppStore.Instance.activeFrame?.regionSet.toggleSelectedRegionsVisibility();
    };

    private getHandlers = (): AppearanceFormHandlers => {
        return {
            setColor: value => this.applyToSelected(region => region.setColor(value)),
            setLineWidth: value => this.applyToSelected(region => region.setLineWidth(value)),
            setDashLength: value => this.applyToSelected(region => region.setDashLength(value)),
            setPointShape: value => this.applyByType(CARTA.RegionType.ANNPOINT, region => (region as PointAnnotationStore).setPointShape(value)),
            setPointWidth: value => this.applyByType(CARTA.RegionType.ANNPOINT, region => (region as PointAnnotationStore).setPointWidth(value)),
            setFontSize: value =>
                this.applyToSelected(region => {
                    if (region.regionType === CARTA.RegionType.ANNTEXT || region.regionType === CARTA.RegionType.ANNCOMPASS || region.regionType === CARTA.RegionType.ANNRULER) {
                        (region as TextAnnotationStore).setFontSize(value);
                    }
                }),
            setFont: value =>
                this.applyToSelected(region => {
                    if (region.regionType === CARTA.RegionType.ANNTEXT || region.regionType === CARTA.RegionType.ANNCOMPASS || region.regionType === CARTA.RegionType.ANNRULER) {
                        (region as TextAnnotationStore).setFont(value);
                    }
                }),
            setFontStyle: value =>
                this.applyToSelected(region => {
                    if (region.regionType === CARTA.RegionType.ANNTEXT || region.regionType === CARTA.RegionType.ANNCOMPASS || region.regionType === CARTA.RegionType.ANNRULER) {
                        (region as TextAnnotationStore).setFontStyle(value);
                    }
                }),
            setVectorPointerLength: value => this.applyByType(CARTA.RegionType.ANNVECTOR, region => (region as VectorAnnotationStore).setPointerLength(value)),
            setVectorPointerWidth: value => this.applyByType(CARTA.RegionType.ANNVECTOR, region => (region as VectorAnnotationStore).setPointerWidth(value)),
            setCompassNorthTextOffsetX: value => this.applyByType(CARTA.RegionType.ANNCOMPASS, region => (region as CompassAnnotationStore).setNorthTextOffset(value, true)),
            setCompassNorthTextOffsetY: value => this.applyByType(CARTA.RegionType.ANNCOMPASS, region => (region as CompassAnnotationStore).setNorthTextOffset(value, false)),
            setCompassEastTextOffsetX: value => this.applyByType(CARTA.RegionType.ANNCOMPASS, region => (region as CompassAnnotationStore).setEastTextOffset(value, true)),
            setCompassEastTextOffsetY: value => this.applyByType(CARTA.RegionType.ANNCOMPASS, region => (region as CompassAnnotationStore).setEastTextOffset(value, false)),
            setCompassArrowheads: selection =>
                this.applyByType(CARTA.RegionType.ANNCOMPASS, region => {
                    const compassRegion = region as CompassAnnotationStore;
                    if (selection === "north") {
                        compassRegion.setNorthArrowhead(true);
                        compassRegion.setEastArrowhead(false);
                    } else if (selection === "east") {
                        compassRegion.setNorthArrowhead(false);
                        compassRegion.setEastArrowhead(true);
                    } else {
                        compassRegion.setNorthArrowhead(true);
                        compassRegion.setEastArrowhead(true);
                    }
                }),
            setCompassPointerLength: value => this.applyByType(CARTA.RegionType.ANNCOMPASS, region => (region as CompassAnnotationStore).setPointerLength(value)),
            setCompassPointerWidth: value => this.applyByType(CARTA.RegionType.ANNCOMPASS, region => (region as CompassAnnotationStore).setPointerWidth(value)),
            setRulerDecimals: value => this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setDecimals(value)),
            setRulerAuxiliaryLineVisible: value => this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setAuxiliaryLineVisible(value)),
            setRulerAuxiliaryLineDashLength: value => this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setAuxiliaryLineDashLength(value)),
            setRulerTextOffsetX: value => this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setTextOffset(value, true)),
            setRulerTextOffsetY: value => this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setTextOffset(value, false)),
            setRulerAuxiliaryTextVisible: value => this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setAuxiliaryTextVisible(value)),
            setRulerXTextOffsetX: value => this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setXTextOffset(value, true)),
            setRulerXTextOffsetY: value => this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setXTextOffset(value, false)),
            setRulerYTextOffsetX: value => this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setYTextOffset(value, true)),
            setRulerYTextOffsetY: value => this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setYTextOffset(value, false)),
            setTextAlignment: value => this.applyByType(CARTA.RegionType.ANNTEXT, region => (region as TextAnnotationStore).setPosition(value))
        };
    };

    public render() {
        const appStore = AppStore.Instance;
        const className = classNames("group-region-dialog", {[Classes.DARK]: appStore.darkTheme});
        const activeFrame = appStore.activeFrame;
        const primaryRegion = activeFrame?.regionSet.selectedRegion;
        const selectedRegions = activeFrame?.regionSet.selectedRegionsList ?? [];
        const editableRegion = !!primaryRegion && selectedRegions.length > 1;
        const allLocked = activeFrame?.regionSet.selectedRegionsAllLocked ?? false;
        const anyVisible = activeFrame?.regionSet.selectedRegionsAnyVisible ?? false;

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
        if (editableRegion && activeFrame) {
            dialogProps.title = `Editing ${selectedRegions.length} Regions (${activeFrame.filename})`;
            bodyContent = <AppearanceForm region={primaryRegion} darkTheme={appStore.darkTheme} handlers={this.getHandlers()} />;
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
                        {editableRegion && (
                            <>
                                <Tooltip content={anyVisible ? "Hide all selected regions" : "Show all selected regions"}>
                                    <AnchorButton intent={Intent.WARNING} minimal={true} icon={anyVisible ? "eye-open" : "eye-off"} onClick={this.handleHideClicked} />
                                </Tooltip>
                                <Tooltip content={allLocked ? "Unlock all selected regions" : "Lock all selected regions"}>
                                    <AnchorButton intent={Intent.WARNING} minimal={true} icon={allLocked ? "lock" : "unlock"} onClick={this.handleLockClicked} />
                                </Tooltip>
                                <Tooltip content="Delete all selected regions">
                                    <AnchorButton intent={Intent.DANGER} icon="trash" text="Delete" onClick={this.handleDeleteClicked} />
                                </Tooltip>
                            </>
                        )}
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
