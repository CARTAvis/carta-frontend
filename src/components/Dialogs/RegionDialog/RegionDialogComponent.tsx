import * as React from "react";
import {AnchorButton, Classes, IDialogProps, Intent, NonIdealState, Tab, Tabs} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {CARTA} from "carta-protobuf";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {CustomIcon} from "icons/CustomIcons";
import {FloatingObjzIndexManager} from "models";
import {AppStore, DialogId, HelpType} from "stores";
import {RegionStore} from "stores/Frame";

import {AppearanceForm} from "./AppearanceForm/AppearanceForm";
import {CompassRulerRegionForm} from "./CompassRulerRegionForm/CompassRulerRegionForm";
import {EllipticalRegionForm} from "./EllipticalRegionForm/EllipticalRegionForm";
import {LineRegionForm} from "./LineRegionForm/LineRegionForm";
import {PointRegionForm} from "./PointRegionForm/PointRegionForm";
import {PolygonRegionForm} from "./PolygonRegionForm/PolygonRegionForm";
import {RectangularRegionForm} from "./RectangularRegionForm/RectangularRegionForm";

import "./RegionDialogComponent.scss";

enum RegionDialogTabs {
    Configuration,
    Styling
}

@observer
export class RegionDialogComponent extends React.Component {
    @observable selectedTab: RegionDialogTabs = RegionDialogTabs.Configuration;

    @action private setSelectedTab = (tab: RegionDialogTabs) => {
        this.selectedTab = tab;
    };

    constructor(props) {
        super(props);
        makeObservable(this);
    }

    private static readonly MissingRegionNode = (<NonIdealState icon={"folder-open"} title={"No region selected"} description={"Select a region using the list or image view"} />);
    private static readonly InvalidRegionNode = (<NonIdealState icon={"error"} title={"Region not supported"} description={"The selected region does not have any editable properties"} />);

    private static readonly DefaultWidth = 525;
    private static readonly DefaultHeight = 575;
    private static readonly MinWidth = 450;
    private static readonly MinHeight = 300;

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

        const floatingObjzIndexManager = FloatingObjzIndexManager.Instance;
        let zIndex = floatingObjzIndexManager.findIndex(DialogId.Region, appStore.floatingObjs);

        const dialogProps: IDialogProps = {
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

        let bodyContent, configurationPanel;
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
                case CARTA.RegionType.ANNPOINT:
                    configurationPanel = <PointRegionForm region={region} wcsInfo={frame.validWcs ? frame.wcsInfoForTransformation : 0} />;
                    editableRegion = true;
                    break;
                case CARTA.RegionType.RECTANGLE:
                case CARTA.RegionType.ANNRECTANGLE:
                case CARTA.RegionType.ANNTEXT:
                    configurationPanel = <RectangularRegionForm region={region} frame={frame} wcsInfo={frame.validWcs ? frame.wcsInfoForTransformation : 0} />;
                    editableRegion = true;
                    break;
                case CARTA.RegionType.ELLIPSE:
                case CARTA.RegionType.ANNELLIPSE:
                    configurationPanel = <EllipticalRegionForm region={region} frame={frame} wcsInfo={frame.validWcs ? frame.wcsInfoForTransformation : 0} />;
                    editableRegion = true;
                    break;
                case CARTA.RegionType.POLYGON:
                case CARTA.RegionType.POLYLINE:
                case CARTA.RegionType.ANNPOLYGON:
                case CARTA.RegionType.ANNPOLYLINE:
                    configurationPanel = <PolygonRegionForm region={region} wcsInfo={frame.validWcs ? frame.wcsInfoForTransformation : 0} />;
                    editableRegion = true;
                    break;
                case CARTA.RegionType.LINE:
                case CARTA.RegionType.ANNLINE:
                case CARTA.RegionType.ANNVECTOR:
                    configurationPanel = <LineRegionForm region={region} frame={frame} wcsInfo={frame.validWcs ? frame.wcsInfoForTransformation : 0} />;
                    editableRegion = true;
                    break;
                case CARTA.RegionType.ANNCOMPASS:
                case CARTA.RegionType.ANNRULER:
                    configurationPanel = <CompassRulerRegionForm region={region} wcsInfo={frame.validWcs ? frame.wcsInfoForTransformation : 0} />;
                    editableRegion = true;
                    break;
                default:
                    bodyContent = RegionDialogComponent.InvalidRegionNode;
            }
            if (editableRegion) {
                const stylingPanel = <AppearanceForm region={region} darkTheme={appStore.darkTheme} />;
                bodyContent = (
                    <Tabs id="regionDialogTabs" selectedTabId={this.selectedTab} onChange={this.setSelectedTab}>
                        <Tab id={RegionDialogTabs.Configuration} title="Configuration" panel={configurationPanel} />
                        <Tab id={RegionDialogTabs.Styling} title="Styling" panel={stylingPanel} />
                    </Tabs>
                );
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
            <DraggableDialogComponent
                dialogProps={dialogProps}
                helpType={HelpType.REGION_DIALOG}
                defaultWidth={RegionDialogComponent.DefaultWidth}
                defaultHeight={RegionDialogComponent.DefaultHeight}
                minHeight={RegionDialogComponent.MinHeight}
                minWidth={RegionDialogComponent.MinWidth}
                enableResizing={true}
                zIndex={zIndex}
                onSelected={() => floatingObjzIndexManager.updateIndexOnSelect(DialogId.Region, appStore.floatingObjs)}
                onClosed={() => floatingObjzIndexManager.updateIndexOnRemove(DialogId.Region, appStore.floatingObjs)}
            >
                <div className={Classes.DIALOG_BODY}>{bodyContent}</div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        {tooltips}
                        {editableRegion && <AnchorButton intent={Intent.DANGER} icon={"trash"} text="Delete" onClick={this.handleDeleteClicked} />}
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
