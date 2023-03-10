import * as React from "react";
import {AnchorButton, Classes, DialogProps, Intent, NonIdealState} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {CARTA} from "carta-protobuf";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {CustomIcon} from "icons/CustomIcons";
import {AppStore, HelpType} from "stores";
import {RegionStore} from "stores/Frame";

import {AppearanceForm} from "./AppearanceForm/AppearanceForm";
import {EllipticalRegionForm} from "./EllipticalRegionForm/EllipticalRegionForm";
import {LineRegionForm} from "./LineRegionForm/LineRegionForm";
import {PointRegionForm} from "./PointRegionForm/PointRegionForm";
import {PolygonRegionForm} from "./PolygonRegionForm/PolygonRegionForm";
import {RectangularRegionForm} from "./RectangularRegionForm/RectangularRegionForm";

import "./RegionDialogComponent.scss";

@observer
export class RegionDialogComponent extends React.Component {
    private static readonly MissingRegionNode = (<NonIdealState icon={"folder-open"} title={"No region selected"} description={"Select a region using the list or image view"} />);
    private static readonly InvalidRegionNode = (<NonIdealState icon={"error"} title={"Region not supported"} description={"The selected region does not have any editable properties"} />);

    private handleDeleteClicked = () => {
        const appStore = AppStore.Instance;
        appStore.dialogStore.hideRegionDialog();
        if (appStore.activeFrame && appStore.activeFrame.regionSet.selectedRegion) {
            appStore.deleteRegion(appStore.activeFrame.regionSet.selectedRegion);
        }
    };

    private handleFocusClicked = () => AppStore.Instance.activeFrame.regionSet.selectedRegion.focusCenter();

    public render() {
        const appStore = AppStore.Instance;

        const dialogProps: DialogProps = {
            icon: "info-sign",
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: true,
            lazy: true,
            isOpen: appStore.dialogStore.regionDialogVisible,
            onClose: appStore.dialogStore.hideRegionDialog,
            className: "region-dialog",
            canEscapeKeyClose: true,
            title: "No region selected"
        };

        let bodyContent;
        let region: RegionStore;
        let editableRegion = false;
        if (!appStore.activeFrame || !appStore.activeFrame.regionSet.selectedRegion) {
            bodyContent = RegionDialogComponent.MissingRegionNode;
        } else if (appStore.activeFrame.regionSet.selectedRegion.regionId === 0) {
            bodyContent = RegionDialogComponent.InvalidRegionNode;
        } else {
            region = appStore.activeFrame.regionSet.selectedRegion;
            const frame = appStore.activeFrame.spatialReference ?? appStore.activeFrame;
            dialogProps.title = `Editing ${region.nameString} (${frame.filename})`;
            switch (region.regionType) {
                case CARTA.RegionType.POINT:
                    bodyContent = (
                        <React.Fragment>
                            <AppearanceForm region={region} darkTheme={appStore.darkTheme} />
                            <PointRegionForm region={region} wcsInfo={frame.validWcs ? frame.wcsInfoForTransformation : 0} />
                        </React.Fragment>
                    );
                    editableRegion = true;
                    break;
                case CARTA.RegionType.RECTANGLE:
                    bodyContent = (
                        <React.Fragment>
                            <AppearanceForm region={region} darkTheme={appStore.darkTheme} />
                            <RectangularRegionForm region={region} frame={frame} wcsInfo={frame.validWcs ? frame.wcsInfoForTransformation : 0} />
                        </React.Fragment>
                    );
                    editableRegion = true;
                    break;
                case CARTA.RegionType.ELLIPSE:
                    bodyContent = (
                        <React.Fragment>
                            <AppearanceForm region={region} darkTheme={appStore.darkTheme} />
                            <EllipticalRegionForm region={region} frame={frame} wcsInfo={frame.validWcs ? frame.wcsInfoForTransformation : 0} />
                        </React.Fragment>
                    );
                    editableRegion = true;
                    break;
                case CARTA.RegionType.POLYGON:
                case CARTA.RegionType.POLYLINE:
                    bodyContent = (
                        <React.Fragment>
                            <AppearanceForm region={region} darkTheme={appStore.darkTheme} />
                            <PolygonRegionForm region={region} wcsInfo={frame.validWcs ? frame.wcsInfoForTransformation : 0} />
                        </React.Fragment>
                    );
                    editableRegion = true;
                    break;
                case CARTA.RegionType.LINE:
                    bodyContent = (
                        <React.Fragment>
                            <AppearanceForm region={region} darkTheme={appStore.darkTheme} />
                            <LineRegionForm region={region} frame={frame} wcsInfo={frame.validWcs ? frame.wcsInfoForTransformation : 0} />
                        </React.Fragment>
                    );
                    editableRegion = true;
                    break;
                default:
                    bodyContent = RegionDialogComponent.InvalidRegionNode;
            }
        }

        let tooltips = region && region.regionId !== 0 && (
            <React.Fragment>
                <Tooltip2 content={`Region is ${region.locked ? "locked" : "unlocked"}`}>
                    <AnchorButton intent={Intent.WARNING} minimal={true} icon={region.locked ? "lock" : "unlock"} onClick={region.toggleLock} />
                </Tooltip2>
                <Tooltip2 content={"Focus"}>
                    <AnchorButton intent={Intent.WARNING} minimal={true} icon={<CustomIcon icon="center" />} onClick={this.handleFocusClicked} />
                </Tooltip2>
            </React.Fragment>
        );

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.REGION_DIALOG} defaultWidth={775} defaultHeight={475} minHeight={300} minWidth={400} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>{bodyContent}</div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        {tooltips}
                        {editableRegion && <AnchorButton intent={Intent.DANGER} icon={"trash"} text="Delete" onClick={this.handleDeleteClicked} />}
                        <AnchorButton intent={Intent.NONE} onClick={appStore.dialogStore.hideRegionDialog} text="Close" />
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
