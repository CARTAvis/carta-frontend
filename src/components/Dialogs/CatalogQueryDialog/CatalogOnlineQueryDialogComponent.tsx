import * as React from "react";
import axios, {CancelTokenSource} from "axios";
import {observer} from "mobx-react";
import {AnchorButton, Button, FormGroup, IDialogProps, Intent, MenuItem, NonIdealState, Overlay, PopoverPosition, Spinner} from "@blueprintjs/core";
import {IItemRendererProps, Select} from "@blueprintjs/select";
import {AppStore, CatalogOnlineQueryConfigStore, CatalogDatabase, HelpType, RadiusUnits} from "stores";
import {DraggableDialogComponent} from "components/Dialogs";
import {ClearableNumericInputComponent, SafeNumericInput} from "components/Shared";
import {CatalogSystemType} from "models";
import "./CatalogOnlineQueryDialogComponent.scss";

@observer
export class CatalogQueryDialogComponent extends React.Component {
    private static readonly DefaultWidth = 550;
    private static readonly DefaultHeight = 500;

    private cancelTokenSource: CancelTokenSource;

    constructor(props: any) {
        super(props);
        this.cancelTokenSource = axios.CancelToken.source();
    }

    public render() {
        const appStore = AppStore.Instance;
        const configStore = CatalogOnlineQueryConfigStore.Instance;

        let className = "catalog-query-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "geosearch",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.catalogQueryDialogVisible,
            onClose: appStore.dialogStore.hideCatalogQueryDialog,
            title: "Online Catalog Query"
        };

        if (!appStore || !appStore.activeFrame) {
            return (
                <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.ONLINE_CATALOG_QUERY} defaultWidth={CatalogQueryDialogComponent.DefaultWidth} defaultHeight={CatalogQueryDialogComponent.DefaultHeight} enableResizing={true}>
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                </DraggableDialogComponent>
            );
        }

        const disable = configStore.isQuerying;
        // console.log(appStore.activeFrame.center, 
        //     appStore.activeFrame.cursorInfo, 
        //     configStore.radiusInDeg, 
        //     OverlayStore.Instance.global.defaultSystem, 
        //     OverlayStore.Instance.numbers.formatX,
        //     configStore.coordsType)
        const configBoard = (
            <div className="online-catalog-config">
                <FormGroup inline={false} label="Database" disabled={disable}>
                    <Select
                        items={Object.values(CatalogDatabase)}
                        activeItem={null}
                        onItemSelect={db => configStore.setCatalogDB(db)}
                        itemRenderer={this.renderDBPopOver}
                        disabled={disable}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        filterable={false}
                        resetOnSelect={true}
                    >
                        <Button text={configStore.catalogDB} disabled={disable} rightIcon="double-caret-vertical" />
                    </Select>
                </FormGroup>
                <FormGroup inline={false} label="Search Radius" disabled={disable}>
                    <SafeNumericInput
                        disabled={disable}
                        min={0}
                        clampValueOnBlur={true}
                        value={configStore.searchRadius}
                        stepSize={0.5}
                        onValueChange={(value: number) => configStore.setSearchRadius(value)}
                    />
                    <Select
                        items={Object.values(RadiusUnits)}
                        activeItem={null}
                        onItemSelect={units => configStore.setRadiusUnits(units)}
                        itemRenderer={this.renderUnitsPopOver}
                        disabled={disable}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        filterable={false}
                        resetOnSelect={true}
                    >
                        <Button text={configStore.radiusUnits} disabled={disable} rightIcon="double-caret-vertical" />
                    </Select>
                </FormGroup>
                <FormGroup inline={false} label="Center Coordinates" disabled={disable}>
                    <Select
                        items={Object.values(CatalogSystemType).filter(type => type!== CatalogSystemType.Pixel0 && type!== CatalogSystemType.Pixel1)}
                        activeItem={null}
                        onItemSelect={type => configStore.setCoordsType(type)}
                        itemRenderer={this.renderSysTypePopOver}
                        disabled={disable}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        filterable={false}
                        resetOnSelect={true}
                    >
                        <Button text={configStore.coordsType} disabled={disable} rightIcon="double-caret-vertical" />
                    </Select>
                    <SafeNumericInput
                        buttonPosition={"none"}
                        placeholder="Ra"
                        disabled={disable}
                        value={configStore.centerCoord.x}
                        onValueChange={(valueAsNumber: number ,valueAsString: string) => configStore.setCenterCoord(valueAsString, "X")}
                    />
                    <SafeNumericInput
                        buttonPosition={"none"}
                        placeholder="Dec"
                        disabled={disable}
                        value={configStore.centerCoord.y}
                        onValueChange={(valueAsNumber: number ,valueAsString: string) => configStore.setCenterCoord(valueAsString, "Y")}
                    />
                    {/* <Button icon="locate" disabled={disable} onClick={() => configStore.setImageCenter()} /> */}
                </FormGroup>
                <ClearableNumericInputComponent
                    label="Max Number of Objects"
                    min={CatalogOnlineQueryConfigStore.MIN_OBJECTS}
                    integerOnly={true}
                    value={configStore.maxObject}
                    onValueChanged={val => configStore.setMaxObjects(val)}
                    onValueCleared={() => configStore.resetMaxObjects()}
                    displayExponential={false}
                    disabled={disable}
                    inline={false}
                />
            </div>
        );

        return (
            <DraggableDialogComponent 
                dialogProps={dialogProps} 
                helpType={HelpType.ONLINE_CATALOG_QUERY} 
                minWidth={CatalogQueryDialogComponent.DefaultWidth} 
                minHeight={CatalogQueryDialogComponent.DefaultHeight} 
                defaultWidth={CatalogQueryDialogComponent.DefaultWidth} 
                defaultHeight={CatalogQueryDialogComponent.DefaultHeight} 
                enableResizing={true}
            >
                <div className="bp3-dialog-body">
                    {configBoard}
                </div>
                <Overlay autoFocus={true} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={disable} usePortal={false}>
                    <div className="query-loading-overlay">
                        <Spinner intent={Intent.PRIMARY} size={30} value={null} />
                    </div>
                </Overlay>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <AnchorButton
                            intent={Intent.SUCCESS}
                            disabled={disable}
                            onClick={() => this.query()}
                            text={"Query"}
                        />
                        <AnchorButton
                            intent={Intent.WARNING}
                            disabled={!configStore.isQuerying}
                            onClick={() => this.cancelQuery()}
                            text={"Cancel"}
                        />
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }

    private query = () => {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        // In Simbad, the coordinate system parameter is never interpreted. All coordinates MUST be expressed in the ICRS coordinate system 
        const baseUrl = "https://simbad.u-strasbg.fr/simbad/sim-tap/sync?request=doQuery&lang=adql&format=json&query=";
        const query = `SELECT Top ${configStore.maxObject} * FROM basic WHERE CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${configStore.centerCoord.x},${configStore.centerCoord.y},${configStore.radiusInDeg}))=1 AND ra IS NOT NULL AND dec IS NOT NULL`;
        configStore.setQueryStatus(true);
        
        AppStore.Instance.appendOnlineCatalog(baseUrl, query, this.cancelTokenSource)
        .then(catalogFileId => {
            console.log(catalogFileId)
            configStore.setQueryStatus(false);
        })
        .catch(error => {
            configStore.setQueryStatus(false);
            if(axios.isCancel(error)){
                this.cancelTokenSource = axios.CancelToken.source();
            } else {
                console.log(error);
            }
        });
    }

    private cancelQuery = () => {
        this.cancelTokenSource.cancel("Query canceled");
    }

    private renderDBPopOver = (catalogDB: CatalogDatabase, itemProps: IItemRendererProps) => {
        return <MenuItem key={catalogDB} text={catalogDB} onClick={itemProps.handleClick} />;
    };

    private renderUnitsPopOver = (units: RadiusUnits, itemProps: IItemRendererProps) => {
        return <MenuItem key={units} text={units} onClick={itemProps.handleClick} />;
    };

    private renderSysTypePopOver = (type: CatalogSystemType, itemProps: IItemRendererProps) => {
        return <MenuItem key={type} text={type} onClick={itemProps.handleClick} />;
    };
}