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

import {AppearanceForm, type AppearanceFormHandlers} from "../RegionDialog/AppearanceForm/AppearanceForm";

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

    private getHandlers = (): AppearanceFormHandlers => {
        return {
            setColor: value => this.applyToSelected(region => region.setColor(value)),
            setLineWidth: value => this.applyToSelected(region => region.setLineWidth(value)),
            setDashLength: value => this.applyToSelected(region => region.setDashLength(value)),
            setPointShape: value => this.applyByType(CARTA.RegionType.ANNPOINT, region => (region as PointAnnotationStore).setPointShape(value)),
            setPointWidth: value => this.applyByType(CARTA.RegionType.ANNPOINT, region => (region as PointAnnotationStore).setPointWidth(value)),
            setFontSize: value => this.applyByType(FONT_REGION_TYPES, region => (region as TextAnnotationStore).setFontSize(value)),
            setFont: value => this.applyByType(FONT_REGION_TYPES, region => (region as TextAnnotationStore).setFont(value)),
            setFontStyle: value => this.applyByType(FONT_REGION_TYPES, region => (region as TextAnnotationStore).setFontStyle(value)),
            setVectorPointerLength: value => this.applyByType(CARTA.RegionType.ANNVECTOR, region => (region as VectorAnnotationStore).setPointerLength(value)),
            setVectorPointerWidth: value => this.applyByType(CARTA.RegionType.ANNVECTOR, region => (region as VectorAnnotationStore).setPointerWidth(value)),
            setCompassNorthTextOffsetX: value => this.applyByType(CARTA.RegionType.ANNCOMPASS, region => (region as CompassAnnotationStore).setNorthTextOffset(value, true)),
            setCompassNorthTextOffsetY: value => this.applyByType(CARTA.RegionType.ANNCOMPASS, region => (region as CompassAnnotationStore).setNorthTextOffset(value, false)),
            setCompassEastTextOffsetX: value => this.applyByType(CARTA.RegionType.ANNCOMPASS, region => (region as CompassAnnotationStore).setEastTextOffset(value, true)),
            setCompassEastTextOffsetY: value => this.applyByType(CARTA.RegionType.ANNCOMPASS, region => (region as CompassAnnotationStore).setEastTextOffset(value, false)),
            setCompassArrowheads: selection =>
                this.applyByType(CARTA.RegionType.ANNCOMPASS, region => {
                    const compassRegion = region as CompassAnnotationStore;
                    compassRegion.setNorthArrowhead(selection !== "east");
                    compassRegion.setEastArrowhead(selection !== "north");
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
        const primaryRegion = activeFrame?.regionSet.focusedRegion;
        const selectedRegions = activeFrame?.regionSet.selectedRegionsList ?? [];
        const canEditSelectedRegions = !!primaryRegion && selectedRegions.length > 1;
        const allLocked = activeFrame?.regionSet.selectedRegionsAllLocked ?? false;
        const selectedRegionsVisibility = activeFrame?.regionSet.selectedRegionsVisibility ?? RegionsOpacity.Invisible;
        const selectedRegionsVisible = selectedRegionsVisibility !== RegionsOpacity.Invisible;
        const lockDisabled = !!activeFrame?.regionSet.locked || selectedRegionsVisibility === RegionsOpacity.Invisible;
        const showLockedIcon = lockDisabled || allLocked;

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
            bodyContent = <AppearanceForm region={primaryRegion} darkTheme={appStore.darkTheme} handlers={this.getHandlers()} visibleControls={AppearanceForm.getCommonControls(selectedRegions)} />;
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
                                <AnchorButton intent={Intent.DANGER} icon="trash" text="Delete" onClick={this.handleDeleteClicked} style={{userSelect: "none"}} />
                            </>
                        )}
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
