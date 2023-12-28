import * as React from "react";
import {AnchorButton, Button, DialogProps, FormGroup, Icon, InputGroup, Intent, MenuItem, NonIdealState, Overlay, PopoverPosition, Position, Spinner, Tooltip} from "@blueprintjs/core";
import {ItemRendererProps, MultiSelect, Select} from "@blueprintjs/select";
import FuzzySearch from "fuzzy-search";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {ClearableNumericInputComponent, SafeNumericInput} from "components/Shared";
import {CatalogApiService, CatalogDatabase} from "services";
import {AppStore, CatalogOnlineQueryConfigStore, HelpType, NUMBER_FORMAT_LABEL, RadiusUnits, SystemType, VizierItem} from "stores";
import {clamp, getFormattedWCSPoint, getPixelValueFromWCS, isWCSStringFormatValid} from "utilities";

import "./CatalogOnlineQueryDialogComponent.scss";

const KEYCODE_ENTER = 13;

@observer
export class CatalogQueryDialogComponent extends React.Component {
    private static readonly DefaultWidth = 600;
    private static readonly DefaultHeight = 550;
    private static readonly MinWidth = 550;
    private static readonly MinHeight = 450;

    @observable resultSize: number;
    @observable objectSize: number;

    constructor(props: any) {
        super(props);
        makeObservable(this);
        this.resultSize = undefined;
        this.objectSize = undefined;
    }

    @action setResultSize(resultSize: number) {
        this.resultSize = resultSize;
    }

    @action setObjectSize(objectSize: number) {
        this.objectSize = objectSize;
    }

    @computed get resultInfo(): string {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        if (configStore.isQuerying) {
            return `Querying ${configStore.catalogDB}`;
        } else if (configStore.isObjectQuerying) {
            return `Querying ${CatalogDatabase.SIMBAD}`;
        } else if (this.resultSize === 0) {
            return "No objects found";
        } else if (this.resultSize >= 1) {
            if (configStore.catalogDB === CatalogDatabase.VIZIER) {
                return `Found ${this.resultSize} table(s)`;
            } else {
                return `Found ${this.resultSize} object(s)`;
            }
        } else if (this.objectSize === 0) {
            return `Object ${configStore.objectName} not found`;
        } else if (this.objectSize >= 1) {
            return `Updated Center Coordinates according ${configStore.objectName}`;
        }
        return undefined;
    }

    public render() {
        const appStore = AppStore.Instance;
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        let className = "catalog-query-dialog";
        if (appStore.darkTheme) {
            className += " bp5-dark";
        }

        const dialogProps: DialogProps = {
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
                <DraggableDialogComponent
                    dialogProps={dialogProps}
                    helpType={HelpType.ONLINE_CATALOG_QUERY}
                    defaultWidth={CatalogQueryDialogComponent.DefaultWidth}
                    defaultHeight={CatalogQueryDialogComponent.DefaultHeight}
                    minWidth={CatalogQueryDialogComponent.MinWidth}
                    minHeight={CatalogQueryDialogComponent.MinHeight}
                    enableResizing={true}
                >
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                </DraggableDialogComponent>
            );
        }

        const disable = configStore.isQuerying || configStore.isObjectQuerying;
        let sourceIndicater;
        let objectSize = this.objectSize;
        if (configStore.disableObjectSearch) {
            objectSize = undefined;
        }

        if (objectSize === 0) {
            sourceIndicater = <Icon icon="cross" intent="warning" iconSize={30} />;
        } else if (objectSize === 1) {
            sourceIndicater = <Icon icon="tick" intent="success" iconSize={30} />;
        }

        const frame = appStore.activeFrame.spatialReference ?? appStore.activeFrame;
        const formatX = AppStore.Instance.overlayStore.numbers.formatTypeX;
        const formatY = AppStore.Instance.overlayStore.numbers.formatTypeY;
        const wcsInfo = frame.validWcs ? frame.wcsInfoForTransformation : 0;
        const centerWcsPoint = getFormattedWCSPoint(wcsInfo, configStore.centerPixelCoordAsPoint2D);
        const isVizier = configStore.catalogDB === CatalogDatabase.VIZIER;

        const configBoard = (
            <div className="online-catalog-config">
                <FormGroup inline={false} label="Database" disabled={disable} className={isVizier ? "vizier-databse" : ""}>
                    <Select
                        items={Object.values(CatalogDatabase)}
                        activeItem={null}
                        onItemSelect={db => configStore.setCatalogDB(db)}
                        itemRenderer={this.renderDBPopOver}
                        disabled={disable}
                        popoverProps={{minimal: true}}
                        filterable={false}
                        resetOnSelect={true}
                    >
                        <Button text={configStore.catalogDB} disabled={disable} rightIcon="double-caret-vertical" />
                    </Select>
                </FormGroup>
                {isVizier ? (
                    <FormGroup inline={false} label="Keywords (catalog title)" disabled={disable} className={isVizier ? "vizier-key-words" : ""}>
                        <InputGroup asyncControl={false} disabled={disable} onChange={event => configStore.setVizierKeyWords(event.target.value)} value={configStore.vizierKeyWords} />
                    </FormGroup>
                ) : null}
                <FormGroup inline={false} label="Object" disabled={disable}>
                    <InputGroup asyncControl={false} disabled={disable} rightElement={objectSize === undefined ? null : sourceIndicater} onChange={event => this.updateObjectName(event.target.value)} value={configStore.objectName} />
                    <Tooltip content="Reset center coordinates by object" disabled={disable || configStore.disableObjectSearch} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <Button disabled={disable || configStore.disableObjectSearch} text={"Resolve"} intent={Intent.NONE} onClick={this.handleObjectUpdate} />
                    </Tooltip>
                </FormGroup>
                <FormGroup inline={false} label="Search radius" disabled={disable}>
                    <Tooltip content={`0 - ${configStore.maxRadius} ${configStore.radiusUnits}`} disabled={disable} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <SafeNumericInput
                            asyncControl={true}
                            disabled={disable}
                            buttonPosition={"none"}
                            value={configStore.searchRadius}
                            onValueChange={(value: number) => configStore.setSearchRadius(value)}
                            onBlur={ev => this.handleRadiusChange(ev)}
                            onKeyDown={ev => this.handleRadiusChange(ev)}
                        />
                    </Tooltip>
                    <Select
                        items={Object.values(RadiusUnits)}
                        activeItem={null}
                        onItemSelect={units => configStore.setRadiusUnits(units)}
                        itemRenderer={this.renderUnitsPopOver}
                        disabled={disable}
                        popoverProps={{minimal: true}}
                        filterable={false}
                        resetOnSelect={true}
                    >
                        <Button text={configStore.radiusUnits} disabled={disable} rightIcon="double-caret-vertical" />
                    </Select>
                    <Tooltip content="Reset center coordinates and search radius according current image viewer" disabled={disable} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <Button disabled={disable} onClick={() => configStore.resetSearchRadius()}>
                            Set to viewer
                        </Button>
                    </Tooltip>
                </FormGroup>
                <FormGroup inline={false} label="Center coordinates" disabled={disable}>
                    <Select
                        items={Object.keys(SystemType).map(key => SystemType[key])}
                        activeItem={null}
                        onItemSelect={type => appStore.overlayStore.global.setSystem(type)}
                        itemRenderer={this.renderSysTypePopOver}
                        disabled={disable}
                        popoverProps={{minimal: true}}
                        filterable={false}
                        resetOnSelect={true}
                    >
                        <Button text={appStore.overlayStore.global.system} disabled={disable} rightIcon="double-caret-vertical" />
                    </Select>
                    <Tooltip content={`Format: ${NUMBER_FORMAT_LABEL.get(formatX)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <SafeNumericInput
                            allowNumericCharactersOnly={false}
                            buttonPosition="none"
                            placeholder="X WCS coordinate"
                            disabled={!wcsInfo || !centerWcsPoint || disable}
                            value={centerWcsPoint ? centerWcsPoint.x : ""}
                            onBlur={this.handleCenterWcsXChange}
                            onKeyDown={this.handleCenterWcsXChange}
                        />
                    </Tooltip>
                    <Tooltip content={`Format: ${NUMBER_FORMAT_LABEL.get(formatY)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <SafeNumericInput
                            allowNumericCharactersOnly={false}
                            buttonPosition="none"
                            placeholder="Y WCS coordinate"
                            disabled={!wcsInfo || !centerWcsPoint || disable}
                            value={centerWcsPoint ? centerWcsPoint.y : ""}
                            onBlur={this.handleCenterWcsYChange}
                            onKeyDown={this.handleCenterWcsYChange}
                        />
                    </Tooltip>
                    <Tooltip content="Reset to current view center" disabled={disable} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <Button icon="locate" disabled={disable} onClick={() => configStore.setFrameCenter()} />
                    </Tooltip>
                </FormGroup>
                <ClearableNumericInputComponent
                    label={isVizier ? "Max number of objects per catalog" : "Max number of objects"}
                    min={CatalogOnlineQueryConfigStore.MIN_OBJECTS}
                    max={CatalogOnlineQueryConfigStore.MAX_OBJECTS}
                    integerOnly={true}
                    value={configStore.maxObject}
                    onValueChanged={val => configStore.setMaxObjects(val)}
                    onValueCleared={() => configStore.resetMaxObjects()}
                    displayExponential={false}
                    disabled={disable}
                    inline={false}
                />
                {configStore.showVizierResult ? (
                    <FormGroup inline={false} label="VizieR catalog" disabled={disable}>
                        <MultiSelect
                            placeholder={"Please select catalog tables"}
                            fill={true}
                            popoverProps={{popoverClassName: "vizier-mulit-select", minimal: true, position: PopoverPosition.TOP}}
                            items={configStore.vizierTable}
                            itemRenderer={this.vizierItemRenderer}
                            onItemSelect={item => configStore.updateVizierSelectedTable(item)}
                            selectedItems={configStore.vizierSelectedTableName}
                            tagRenderer={item => item.name}
                            itemPredicate={this.filterVizierTable}
                            noResults={<MenuItem disabled={true} text="No results." />}
                            tagInputProps={{
                                onRemove: v => configStore.removeVizierSelectedTable(v.toString()),
                                rightElement: <Button icon="cross" minimal={true} onClick={() => configStore.resetVizierSelectedTable()} />,
                                tagProps: {minimal: true}
                            }}
                        />
                    </FormGroup>
                ) : null}
            </div>
        );

        const tableInfo = <pre>{this.resultInfo}</pre>;

        return (
            <DraggableDialogComponent
                dialogProps={dialogProps}
                helpType={HelpType.ONLINE_CATALOG_QUERY}
                defaultWidth={CatalogQueryDialogComponent.DefaultWidth}
                defaultHeight={CatalogQueryDialogComponent.DefaultHeight}
                minWidth={CatalogQueryDialogComponent.MinWidth}
                minHeight={CatalogQueryDialogComponent.MinHeight}
                enableResizing={true}
            >
                <div className="bp5-dialog-body">{configBoard}</div>
                <Overlay autoFocus={true} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={disable} usePortal={false}>
                    <div className="query-loading-overlay">
                        <Spinner intent={Intent.PRIMARY} size={30} value={null} />
                    </div>
                </Overlay>
                <div className="bp5-dialog-footer">
                    <div className={"result-info"}>{tableInfo}</div>
                    <div className="bp5-dialog-footer-actions">
                        <AnchorButton intent={Intent.SUCCESS} disabled={disable} onClick={() => this.query()} text={"Query"} />
                        <AnchorButton intent={Intent.WARNING} disabled={!configStore.isQuerying} onClick={() => CatalogApiService.Instance.cancelQuery(configStore.catalogDB)} text={"Cancel"} />
                        {configStore.enableLoadVizier ? <AnchorButton intent={Intent.PRIMARY} disabled={disable} onClick={() => this.loadVizierCatalogs()} text={"Load selected"} /> : null}
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }

    private query = async () => {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        if (configStore.catalogDB === CatalogDatabase.SIMBAD) {
            // In Simbad, the coordinate system parameter is never interpreted. All coordinates MUST be expressed in the ICRS coordinate system
            const centerCoord = configStore.convertToDeg(configStore.centerPixelCoordAsPoint2D, SystemType.ICRS);
            const query = `SELECT Top ${configStore.maxObject} *, DISTANCE(POINT('ICRS', ${centerCoord.x},${centerCoord.y}), POINT('ICRS', ra, dec)) as dist FROM basic WHERE CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${centerCoord.x},${centerCoord.y},${configStore.radiusAsDeg}))=1 AND ra IS NOT NULL AND dec IS NOT NULL order by dist`;
            configStore.setQueryStatus(true);
            const dataSize = await CatalogApiService.Instance.appendSimbadCatalog(query);
            configStore.setQueryStatus(false);
            this.setResultSize(dataSize);
        } else if (configStore.catalogDB === CatalogDatabase.VIZIER) {
            configStore.setQueryStatus(true);
            configStore.resetVizier();
            const centerCoord = configStore.convertToDeg(configStore.centerPixelCoordAsPoint2D, SystemType.FK5);
            const resources = await CatalogApiService.Instance.queryVizierTableName(centerCoord, configStore.searchRadius, configStore.radiusUnits, configStore.vizierKeyWords);
            configStore.setQueryStatus(false);
            configStore.setVizierQueryResult(resources);
            this.setResultSize(resources.size);
        }
    };

    private loadVizierCatalogs = async () => {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const sources = configStore.selectedVizierSource;
        const centerCoord = configStore.convertToDeg(configStore.centerPixelCoordAsPoint2D, SystemType.FK5);
        configStore.setQueryStatus(true);
        const resources = await CatalogApiService.Instance.queryVizierSource(centerCoord, configStore.searchRadius, configStore.radiusUnits, configStore.maxObject, sources);
        CatalogApiService.Instance.appendVizierCatalog(resources);
        configStore.setQueryStatus(false);
    };

    private handleObjectUpdate = () => {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const query = `SELECT basic.* FROM ident JOIN basic ON ident.oidref = basic.oid WHERE id = '${configStore.objectName}'`;
        configStore.setObjectQueryStatus(true);
        CatalogApiService.Instance.getSimbadCatalog(query)
            .then(response => {
                configStore.setObjectQueryStatus(false);
                const size = response.data?.data?.length;
                this.setObjectSize(size);
                if (response.status === 200 && size) {
                    const i = this.getDataIndex("ra", response.data?.metadata);
                    const j = this.getDataIndex("dec", response.data?.metadata);
                    if (i && j && size) {
                        const pixelCoord = configStore.convertToPixel({x: response.data?.data[0][i], y: response.data?.data[0][j]});
                        configStore.updateCenterPixelCoord(pixelCoord);
                    }
                }
            })
            .catch(error => {
                this.setObjectSize(0);
                configStore.setObjectQueryStatus(false);
                console.log(`Object search error ${error}`);
            });
    };

    private getDataIndex = (column: string, metaData: []): number | undefined => {
        for (let index = 0; index < metaData.length; index++) {
            const element = metaData[index];
            if (element["name"] === column) {
                return index;
            }
        }
        return undefined;
    };

    private updateObjectName(val: string) {
        this.initTextInfo();
        CatalogOnlineQueryConfigStore.Instance.setObjectName(val);
    }

    private initTextInfo() {
        this.setObjectSize(undefined);
        this.setResultSize(undefined);
    }

    private renderDBPopOver = (catalogDB: CatalogDatabase, itemProps: ItemRendererProps) => {
        return <MenuItem key={catalogDB} text={catalogDB} onClick={itemProps.handleClick} />;
    };

    private renderUnitsPopOver = (units: RadiusUnits, itemProps: ItemRendererProps) => {
        return <MenuItem key={units} text={units} onClick={itemProps.handleClick} />;
    };

    private renderSysTypePopOver = (type: SystemType, itemProps: ItemRendererProps) => {
        return <MenuItem key={type} text={type} onClick={itemProps.handleClick} />;
    };

    private vizierItemRenderer = (table: VizierItem, itemProps: ItemRendererProps) => {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const isFilmSelected = configStore.vizierSelectedTableName.filter(current => current.name === table.name).length > 0;

        return (
            <MenuItem
                active={itemProps.modifiers.active}
                icon={isFilmSelected ? "tick" : "blank"}
                key={table.name}
                label={table.name}
                onClick={itemProps.handleClick}
                text={`${itemProps.index + 1}. ${table.description}`}
                shouldDismissPopover={false}
            />
        );
    };

    private filterVizierTable = (query: string, item: VizierItem) => {
        const nameSearcher = new FuzzySearch([item.name]);
        const descriptionSearcher = new FuzzySearch([item.description]);
        return nameSearcher.search(query).length > 0 || descriptionSearcher.search(query).length > 0;
    };

    private handleRadiusChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const val = parseFloat(ev.currentTarget.value);
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        if (isFinite(val) && val <= configStore.maxRadius && val >= 0) {
            configStore.setSearchRadius(val);
        } else {
            ev.currentTarget.value = clamp(val, 0, configStore.maxRadius).toString();
        }
    };

    private handleCenterWcsXChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const frame = AppStore.Instance.activeFrame.spatialReference ?? AppStore.Instance.activeFrame;
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const wcsInfo = frame.validWcs ? frame.wcsInfoForTransformation : 0;
        const centerWcsPoint = getFormattedWCSPoint(wcsInfo, configStore.centerPixelCoordAsPoint2D);
        if (!centerWcsPoint) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === centerWcsPoint.x) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeX)) {
            const newPoint = getPixelValueFromWCS(wcsInfo, {x: wcsString, y: centerWcsPoint.y});
            if (newPoint && isFinite(newPoint.x)) {
                configStore.updateCenterPixelCoord(newPoint);
                return;
            }
        }
        ev.currentTarget.value = centerWcsPoint.x;
    };

    private handleCenterWcsYChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const frame = AppStore.Instance.activeFrame.spatialReference ?? AppStore.Instance.activeFrame;
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const wcsInfo = frame.validWcs ? frame.wcsInfoForTransformation : 0;
        const centerWcsPoint = getFormattedWCSPoint(wcsInfo, configStore.centerPixelCoordAsPoint2D);
        if (!centerWcsPoint) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === centerWcsPoint.y) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeY)) {
            const newPoint = getPixelValueFromWCS(wcsInfo, {x: centerWcsPoint.x, y: wcsString});
            if (newPoint && isFinite(newPoint.y)) {
                configStore.updateCenterPixelCoord(newPoint);
                return;
            }
        }
        ev.currentTarget.value = centerWcsPoint.y;
    };
}
