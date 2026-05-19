import * as React from "react";
import {AnchorButton, Classes, type DialogProps, Intent, NonIdealState, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {ScrollShadow} from "components/Shared";
import {DialogId, HelpType, RegionsOpacity} from "enums";
import {AppStore} from "stores";
import {type CompassAnnotationStore, type PointAnnotationStore, type RegionStore, type RulerAnnotationStore, type TextAnnotationStore, type VectorAnnotationStore} from "stores/Frame";

import {type AppearanceChange, AppearanceField, AppearanceForm, type CompassArrowheadSelection} from "../RegionDialog/AppearanceForm/AppearanceForm";

import "./GroupRegionDialogComponent.scss";

const FONT_REGION_TYPES: ReadonlyArray<CARTA.RegionType> = [CARTA.RegionType.ANNTEXT, CARTA.RegionType.ANNCOMPASS, CARTA.RegionType.ANNRULER];

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

    private applyByType = (types: CARTA.RegionType | ReadonlyArray<CARTA.RegionType>, handler: (region: RegionStore) => void) => {
        const typeSet = new Set(Array.isArray(types) ? types : [types as CARTA.RegionType]);
        this.applyToSelected(region => {
            if (typeSet.has(region.regionType)) {
                handler(region);
            }
        });
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

    private handleAppearanceChange = (change: AppearanceChange) => {
        const value = change.value;
        switch (change.field) {
            case AppearanceField.Color:
                this.applyToSelected(region => region.setColor(value as string));
                break;
            case AppearanceField.LineWidth:
                this.applyToSelected(region => region.setLineWidth(value as number));
                break;
            case AppearanceField.DashLength:
                this.applyToSelected(region => region.setDashLength(value as number));
                break;
            case AppearanceField.PointShape:
                this.applyByType(CARTA.RegionType.ANNPOINT, region => (region as PointAnnotationStore).setPointShape(value as CARTA.PointAnnotationShape));
                break;
            case AppearanceField.PointWidth:
                this.applyByType(CARTA.RegionType.ANNPOINT, region => (region as PointAnnotationStore).setPointWidth(value as number));
                break;
            case AppearanceField.FontSize:
                this.applyByType(FONT_REGION_TYPES, region => (region as TextAnnotationStore).setFontSize(value as number));
                break;
            case AppearanceField.Font:
                this.applyByType(FONT_REGION_TYPES, region => (region as TextAnnotationStore).setFont(value as TextAnnotationStore["font"]));
                break;
            case AppearanceField.FontStyle:
                this.applyByType(FONT_REGION_TYPES, region => (region as TextAnnotationStore).setFontStyle(value as TextAnnotationStore["fontStyle"]));
                break;
            case AppearanceField.VectorPointerLength:
                this.applyByType(CARTA.RegionType.ANNVECTOR, region => (region as VectorAnnotationStore).setPointerLength(value as number));
                break;
            case AppearanceField.VectorPointerWidth:
                this.applyByType(CARTA.RegionType.ANNVECTOR, region => (region as VectorAnnotationStore).setPointerWidth(value as number));
                break;
            case AppearanceField.CompassNorthTextOffsetX:
                this.applyByType(CARTA.RegionType.ANNCOMPASS, region => (region as CompassAnnotationStore).setNorthTextOffset(value as number, true));
                break;
            case AppearanceField.CompassNorthTextOffsetY:
                this.applyByType(CARTA.RegionType.ANNCOMPASS, region => (region as CompassAnnotationStore).setNorthTextOffset(value as number, false));
                break;
            case AppearanceField.CompassEastTextOffsetX:
                this.applyByType(CARTA.RegionType.ANNCOMPASS, region => (region as CompassAnnotationStore).setEastTextOffset(value as number, true));
                break;
            case AppearanceField.CompassEastTextOffsetY:
                this.applyByType(CARTA.RegionType.ANNCOMPASS, region => (region as CompassAnnotationStore).setEastTextOffset(value as number, false));
                break;
            case AppearanceField.CompassArrowheads:
                this.applyCompassArrowheadChange(value as CompassArrowheadSelection);
                break;
            case AppearanceField.CompassPointerLength:
                this.applyByType(CARTA.RegionType.ANNCOMPASS, region => (region as CompassAnnotationStore).setPointerLength(value as number));
                break;
            case AppearanceField.CompassPointerWidth:
                this.applyByType(CARTA.RegionType.ANNCOMPASS, region => (region as CompassAnnotationStore).setPointerWidth(value as number));
                break;
            case AppearanceField.RulerDecimals:
                this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setDecimals(value as number));
                break;
            case AppearanceField.RulerAuxiliaryLineVisible:
                this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setAuxiliaryLineVisible(value as boolean));
                break;
            case AppearanceField.RulerAuxiliaryLineDashLength:
                this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setAuxiliaryLineDashLength(value as number));
                break;
            case AppearanceField.RulerTextOffsetX:
                this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setTextOffset(value as number, true));
                break;
            case AppearanceField.RulerTextOffsetY:
                this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setTextOffset(value as number, false));
                break;
            case AppearanceField.RulerAuxiliaryTextVisible:
                this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setAuxiliaryTextVisible(value as boolean));
                break;
            case AppearanceField.RulerXTextOffsetX:
                this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setXTextOffset(value as number, true));
                break;
            case AppearanceField.RulerXTextOffsetY:
                this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setXTextOffset(value as number, false));
                break;
            case AppearanceField.RulerYTextOffsetX:
                this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setYTextOffset(value as number, true));
                break;
            case AppearanceField.RulerYTextOffsetY:
                this.applyByType(CARTA.RegionType.ANNRULER, region => (region as RulerAnnotationStore).setYTextOffset(value as number, false));
                break;
            case AppearanceField.TextAlignment:
                this.applyByType(CARTA.RegionType.ANNTEXT, region => (region as TextAnnotationStore).setPosition(value as CARTA.TextAnnotationPosition));
                break;
            default:
                break;
        }
    };

    private applyCompassArrowheadChange = (selection: CompassArrowheadSelection) => {
        this.applyByType(CARTA.RegionType.ANNCOMPASS, region => {
            const compassRegion = region as CompassAnnotationStore;
            compassRegion.setNorthArrowhead(selection !== "east");
            compassRegion.setEastArrowhead(selection !== "north");
        });
    };

    public render() {
        const appStore = AppStore.Instance;
        const className = classNames("group-region-dialog", {[Classes.DARK]: appStore.darkTheme});
        const activeFrame = appStore.activeFrame;
        const primaryRegion = activeFrame?.regionSet.focusedRegion;
        const selectedRegions = activeFrame?.regionSet.selectedRegionsList ?? [];
        const canEditSelectedRegions = !!primaryRegion && selectedRegions.length > 1;
        const allLocked = activeFrame?.regionSet.selectedRegionsAllLocked ?? false;
        const selectedRegionsVisibility = activeFrame?.regionSet.selectedRegionsVisibility ?? RegionsOpacity.Invisible;
        const selectedRegionsVisible = selectedRegionsVisibility !== RegionsOpacity.Invisible;
        const lockDisabled = !!activeFrame?.regionSet.locked || selectedRegionsVisibility === RegionsOpacity.Invisible;
        const showLockedIcon = lockDisabled || allLocked;
        const deleteDisabled = !!activeFrame?.regionSet.locked || selectedRegions.every(region => region.locked);

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
        if (canEditSelectedRegions && activeFrame) {
            dialogProps.title = `Editing ${selectedRegions.length} Regions (${activeFrame.filename})`;
            bodyContent = <AppearanceForm region={primaryRegion} darkTheme={appStore.darkTheme} onChange={this.handleAppearanceChange} visibleControls={AppearanceForm.getCommonControls(selectedRegions)} />;
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
                        {canEditSelectedRegions && (
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
                                        style={{opacity: selectedRegionsVisibility === RegionsOpacity.SemiTransparent ? 0.3 : 1}}
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
