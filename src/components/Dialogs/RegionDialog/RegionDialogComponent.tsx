import * as React from "react";
import {AnchorButton, Classes, FormGroup, HTMLSelect, IDialogProps, Intent, NonIdealState, Switch, Tab, Tabs} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {CARTA} from "carta-protobuf";
import { action, makeObservable, observable } from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {PointShapeSelectComponent, SafeNumericInput} from "components/Shared";
import {CustomIcon} from "icons/CustomIcons";
import {AppStore, HelpType} from "stores";
import {CompassAnnotationStore, PointAnnotationStore, RegionStore, RulerAnnotationStore, VectorAnnotationStore} from "stores/Frame";

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

    private handleDeleteClicked = () => {
        const appStore = AppStore.Instance;
        appStore.dialogStore.hideRegionDialog();
        if (appStore.activeFrame && appStore.activeFrame.regionSet.selectedRegion) {
            appStore.deleteRegion(appStore.activeFrame.regionSet.selectedRegion);
        }
    };

    private handleFocusClicked = () => AppStore.Instance.activeFrame.regionSet.selectedRegion.focusCenter();

    private handlePointShapeChange = (item: CARTA.PointAnnotationShape) => {
        const appStore = AppStore.Instance;
        const region = appStore.activeFrame.regionSet.selectedRegion;
        const frame = appStore.activeFrame.spatialReference ?? appStore.activeFrame;
        (region as PointAnnotationStore).setPointShape(item);
        frame.pointShapeCache = item;
    };

    private handleCompassAnnotationArrowhead = (selection: string) => {
        const region = AppStore.Instance.activeFrame.regionSet.selectedRegion as CompassAnnotationStore;
        switch (selection) {
            case "north":
                region.setNorthArrowhead(true);
                region.setEastArrowhead(false);
                break;
            case "east":
                region.setNorthArrowhead(false);
                region.setEastArrowhead(true);
                break;
            case "both":
                region.setNorthArrowhead(true);
                region.setEastArrowhead(true);
                break;
        }
    };

    public render() {
        const appStore = AppStore.Instance;

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

        let bodyContent;
        let configurationPanel;
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
                    configurationPanel = (
                        <React.Fragment>
                            <AppearanceForm region={region} darkTheme={appStore.darkTheme}>
                                {region.regionType === CARTA.RegionType.ANNPOINT && (
                                    <>
                                        <FormGroup inline={true} label="Shape">
                                            <PointShapeSelectComponent handleChange={this.handlePointShapeChange} pointShape={(region as PointAnnotationStore).pointShape} />
                                        </FormGroup>
                                        <FormGroup inline={true} label="Size" labelInfo="(px)">
                                            <SafeNumericInput
                                                placeholder="Point size"
                                                min={0.5}
                                                max={50}
                                                value={(region as PointAnnotationStore).pointWidth}
                                                stepSize={0.5}
                                                onValueChange={width => (region as PointAnnotationStore).setPointWidth(width)}
                                            />
                                        </FormGroup>
                                    </>
                                )}
                            </AppearanceForm>
                            <PointRegionForm region={region} wcsInfo={frame.validWcs ? frame.wcsInfoForTransformation : 0} />
                        </React.Fragment>
                    );
                    editableRegion = true;
                    break;
                case CARTA.RegionType.RECTANGLE:
                case CARTA.RegionType.ANNRECTANGLE:
                case CARTA.RegionType.ANNTEXT:
                    configurationPanel = (
                        <React.Fragment>
                            <AppearanceForm region={region} darkTheme={appStore.darkTheme} />
                            <RectangularRegionForm region={region} frame={frame} wcsInfo={frame.validWcs ? frame.wcsInfoForTransformation : 0} />
                        </React.Fragment>
                    );
                    editableRegion = true;
                    break;
                case CARTA.RegionType.ELLIPSE:
                case CARTA.RegionType.ANNELLIPSE:
                    configurationPanel = (
                        <React.Fragment>
                            <AppearanceForm region={region} darkTheme={appStore.darkTheme} />
                            <EllipticalRegionForm region={region} frame={frame} wcsInfo={frame.validWcs ? frame.wcsInfoForTransformation : 0} />
                        </React.Fragment>
                    );
                    editableRegion = true;
                    break;
                case CARTA.RegionType.POLYGON:
                case CARTA.RegionType.POLYLINE:
                case CARTA.RegionType.ANNPOLYGON:
                case CARTA.RegionType.ANNPOLYLINE:
                    configurationPanel = (
                        <React.Fragment>
                            <AppearanceForm region={region} darkTheme={appStore.darkTheme} />
                            <PolygonRegionForm region={region} wcsInfo={frame.validWcs ? frame.wcsInfoForTransformation : 0} />
                        </React.Fragment>
                    );
                    editableRegion = true;
                    break;
                case CARTA.RegionType.LINE:
                case CARTA.RegionType.ANNLINE:
                case CARTA.RegionType.ANNVECTOR:
                    configurationPanel = (
                        <React.Fragment>
                            <AppearanceForm region={region} darkTheme={appStore.darkTheme}>
                                {region.regionType === CARTA.RegionType.ANNVECTOR && (
                                    <div className="form-contents">
                                        <FormGroup inline={true} label="Arrow Tip Length" labelInfo="(px)">
                                            <SafeNumericInput
                                                placeholder="Length"
                                                min={0}
                                                max={RegionStore.MAX_DASH_LENGTH}
                                                value={(region as VectorAnnotationStore).pointerLength}
                                                stepSize={1}
                                                onValueChange={value => (region as VectorAnnotationStore).setPointerLength(value)}
                                            />
                                        </FormGroup>
                                        <FormGroup inline={true} label="Arrow Tip Width" labelInfo="(px)">
                                            <SafeNumericInput
                                                placeholder="Width"
                                                min={0}
                                                max={RegionStore.MAX_DASH_LENGTH}
                                                value={(region as VectorAnnotationStore).pointerWidth}
                                                stepSize={1}
                                                onValueChange={value => (region as VectorAnnotationStore).setPointerWidth(value)}
                                            />
                                        </FormGroup>
                                    </div>
                                )}
                            </AppearanceForm>
                            <LineRegionForm region={region} frame={frame} wcsInfo={frame.validWcs ? frame.wcsInfoForTransformation : 0} />
                        </React.Fragment>
                    );
                    editableRegion = true;
                    break;
                case CARTA.RegionType.ANNCOMPASS:
                case CARTA.RegionType.ANNRULER:
                    configurationPanel = (
                        <React.Fragment>
                            <AppearanceForm region={region} darkTheme={appStore.darkTheme}>
                                {region.regionType === CARTA.RegionType.ANNCOMPASS && (
                                    <div className="form-contents">
                                        <FormGroup inline={true} label="Show Arrowhead">
                                            <HTMLSelect
                                                value={(region as CompassAnnotationStore).eastArrowhead ? ((region as CompassAnnotationStore).northArrowhead ? "both" : "east") : "north"}
                                                onChange={ev => this.handleCompassAnnotationArrowhead(ev.target.value)}
                                            >
                                                <option value={"north"}>North</option>
                                                <option value={"east"}>East</option>
                                                <option value={"both"}>Both</option>
                                            </HTMLSelect>
                                        </FormGroup>
                                        <FormGroup inline={true} label="Arrow Tip Length" labelInfo="(px)">
                                            <SafeNumericInput
                                                placeholder="Length"
                                                min={0}
                                                max={RegionStore.MAX_DASH_LENGTH}
                                                value={(region as CompassAnnotationStore).pointerLength}
                                                stepSize={1}
                                                onValueChange={value => (region as CompassAnnotationStore).setPointerLength(value)}
                                            />
                                        </FormGroup>
                                        <FormGroup inline={true} label="Arrow Tip Width" labelInfo="(px)">
                                            <SafeNumericInput
                                                placeholder="Width"
                                                min={0}
                                                max={RegionStore.MAX_DASH_LENGTH}
                                                value={(region as CompassAnnotationStore).pointerWidth}
                                                stepSize={1}
                                                onValueChange={value => (region as CompassAnnotationStore).setPointerWidth(value)}
                                            />
                                        </FormGroup>
                                    </div>
                                )}
                                {region.regionType === CARTA.RegionType.ANNRULER && (
                                    <div className="form-contents">
                                        <FormGroup inline={true} label="Show auxiliary lines">
                                            <Switch
                                                checked={(region as RulerAnnotationStore).auxiliaryLineVisible}
                                                onChange={(ev: React.ChangeEvent<HTMLInputElement>) => (region as RulerAnnotationStore).setAuxiliaryLineVisible(ev.target.checked)}
                                            />
                                        </FormGroup>
                                        <FormGroup inline={true} label="Auxiliary Lines Dash Length" labelInfo="(px)">
                                            <SafeNumericInput
                                                disabled={!(region as RulerAnnotationStore).auxiliaryLineVisible}
                                                placeholder="Dash Length"
                                                min={0}
                                                max={RegionStore.MAX_DASH_LENGTH}
                                                value={(region as RulerAnnotationStore).auxiliaryLineDashLength}
                                                stepSize={1}
                                                onValueChange={value => (region as RulerAnnotationStore).setAuxiliaryLineDashLength(value)}
                                            />
                                        </FormGroup>
                                        <FormGroup inline={true} label="Text X Offset" labelInfo="(px)">
                                            <SafeNumericInput
                                                placeholder="Text X Offset"
                                                min={-50}
                                                max={RegionStore.MAX_DASH_LENGTH}
                                                value={(region as RulerAnnotationStore).textOffset.x}
                                                stepSize={1}
                                                onValueChange={value => (region as RulerAnnotationStore).setTextOffset(value, true)}
                                            />
                                        </FormGroup>
                                        <FormGroup inline={true} label="Text Y Offset" labelInfo="(px)">
                                            <SafeNumericInput
                                                placeholder="Text Y Offset"
                                                min={-50}
                                                max={RegionStore.MAX_DASH_LENGTH}
                                                value={(region as RulerAnnotationStore).textOffset.y}
                                                stepSize={1}
                                                onValueChange={value => (region as RulerAnnotationStore).setTextOffset(value, false)}
                                            />
                                        </FormGroup>
                                    </div>
                                )}
                            </AppearanceForm>
                            <CompassRulerRegionForm region={region} wcsInfo={frame.validWcs ? frame.wcsInfoForTransformation : 0} />
                        </React.Fragment>
                    );
                    editableRegion = true;
                    break;
                default:
                    bodyContent = RegionDialogComponent.InvalidRegionNode;
            }
            if (editableRegion) {
                bodyContent = (
                    <Tabs id="regionDialogTabs" selectedTabId={this.selectedTab} onChange={this.setSelectedTab}>
                        <Tab id={RegionDialogTabs.Configuration} title="Configuration" panel={configurationPanel} />
                        <Tab id={RegionDialogTabs.Styling} title="Styling" panel={<div>styling placeholder</div>} />
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
