import * as React from "react";
import {AnchorButton, Button, Classes, FormGroup, Icon, InputGroup, Intent, MenuItem, NonIdealState, Overlay2, PopoverPosition, Position, Radio, RadioGroup, Spinner, Tooltip} from "@blueprintjs/core";
import {ItemRendererProps, MultiSelect, Select} from "@blueprintjs/select";
import * as AST from "ast_wrapper";
import FuzzySearch from "fuzzy-search";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {ClearableNumericInputComponent, SafeNumericInput, ScrollShadow} from "components/Shared";
import {Point2D} from "models";
import {CatalogApiService, CatalogDatabase} from "services";
import {AppStore, CatalogOnlineQueryConfigStore, NUMBER_FORMAT_LABEL, NumberFormatType, RadiusUnits, SystemType, VizierItem} from "stores";
import {clamp, getFormattedWCSPoint, getPixelValueFromWCS, isWCSStringFormatValid} from "utilities";

import "./CatalogOnlineQueryComponent.scss";

// Local enum for coordinate format selection
enum LocalCoordinateFormat {
    HMSDMS = "hmsdms",
    Degrees = "degrees",
}

const KEYCODE_ENTER = 13;

@observer
export class CatalogQueryComponent extends React.Component {
    @observable resultSize: number;
    @observable objectSize: number;
    @observable localCoordinateFormat: LocalCoordinateFormat = LocalCoordinateFormat.Degrees;

    constructor(props: any) {
        super(props);
        makeObservable(this);
        this.resultSize = undefined;
        this.objectSize = undefined;
        // Initialize local format based on current global settings
        const appStore = AppStore.Instance;
        if (appStore?.overlaySettings) {
            const formatX = appStore.overlaySettings.numbers.formatTypeX;
            this.localCoordinateFormat = (formatX !== NumberFormatType.Degrees)
                ? LocalCoordinateFormat.HMSDMS
                : LocalCoordinateFormat.Degrees;
        }
    }

    @action setResultSize(resultSize: number) {
        this.resultSize = resultSize;
    }

    @action setObjectSize(objectSize: number) {
        this.objectSize = objectSize;
    }

    @action setLocalCoordinateFormat(format: LocalCoordinateFormat) {
        this.localCoordinateFormat = format;
    }

    // Get formatted WCS point using local coordinate format settings
    private getLocalFormattedWCSPoint(astTransform: any, pixelCoords: Point2D) {
        if (!astTransform) {
            return null;
        }

        // Create a temporary AST transform with the desired format
        const tempTransform = AST.copy(astTransform);
        
        // Set the format based on local coordinate format
        if (this.localCoordinateFormat === LocalCoordinateFormat.HMSDMS && this.supportsHmsDmsFormat()) {
            AST.set(tempTransform, "Format(1)=hms.10, Format(2)=dms.10");
        } else {
            AST.set(tempTransform, "Format(1)=d.10, Format(2)=d.10");
        }

        const wcsCoords = getFormattedWCSPoint(tempTransform, pixelCoords);

        AST.deleteObject(tempTransform);
        
        return wcsCoords;
    }

    // Get format label for tooltips
    private getLocalFormatLabel(axis: 'x' | 'y'): string {
        if (this.localCoordinateFormat === LocalCoordinateFormat.HMSDMS && this.supportsHmsDmsFormat()) {
            return axis === 'x' ? NUMBER_FORMAT_LABEL.get(NumberFormatType.HMS) || 'HMS' : NUMBER_FORMAT_LABEL.get(NumberFormatType.DMS) || 'DMS';
        } else {
            return NUMBER_FORMAT_LABEL.get(NumberFormatType.Degrees) || 'Degrees';
        }
    }

    // Get the appropriate format type for validation
    private getLocalFormatType(axis: 'x' | 'y'): NumberFormatType {
        if (this.localCoordinateFormat === LocalCoordinateFormat.HMSDMS && this.supportsHmsDmsFormat()) {
            return axis === 'x' ? NumberFormatType.HMS : NumberFormatType.DMS;
        } else {
            return NumberFormatType.Degrees;
        }
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
        const global = appStore.overlaySettings.global;

        if (!appStore || !appStore.activeFrame) {
            return <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />;
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
        const wcsInfo = frame.validWcs ? frame.wcsInfoForTransformation : 0;
        // Use local coordinate format for rendering to reflect HMS/DMS <-> Degrees toggle
        const centerWcsPoint = this.getLocalFormattedWCSPoint(wcsInfo, configStore.centerPixelCoordAsPoint2D);
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
                        <InputGroup asyncControl={false} disabled={disable} onChange={event => configStore.setVizierKeyWords(event.target.value)} value={configStore.vizierKeyWords} data-testid="catalog-query-keyword-input" />
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
                            data-testid="catalog-query-search-radius-input"
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
                <FormGroup inline={true} label="Center coordinates" disabled={disable}>
                    <RadioGroup
                        onChange={this.handleFormatToggle}
                        selectedValue={this.localCoordinateFormat}
                        disabled={disable}
                        inline={true}
                    >
                        <Radio value={LocalCoordinateFormat.Degrees} label="Degrees" />
                        <Radio value={LocalCoordinateFormat.HMSDMS} label="HMS/DMS" disabled={!this.supportsHmsDmsFormat()} />
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} disabled={disable} style={{marginTop: -15}}>
                    <Select
                        items={Object.values(SystemType).filter(sys => sys !== SystemType.Image)}
                        activeItem={null}
                        onItemSelect={this.handleSystemTypeChange}
                        itemRenderer={this.renderSysTypePopOver}
                        disabled={disable}
                        popoverProps={{minimal: true}}
                        filterable={false}
                        resetOnSelect={true}
                    >
                        <Button text={this.getSystemTypeKey(global.explicitSystem)} disabled={disable} rightIcon="double-caret-vertical" />
                    </Select>
                    <Tooltip content={`Format: ${this.getLocalFormatLabel('x')}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <SafeNumericInput
                            allowNumericCharactersOnly={false}
                            buttonPosition="none"
                            placeholder="X WCS coordinate"
                            disabled={!wcsInfo || !centerWcsPoint || disable}
                            value={centerWcsPoint ? centerWcsPoint.x : ""}
                            onBlur={this.handleCenterWcsXChange}
                            onKeyDown={this.handleCenterWcsXChange}
                            data-testid="catalog-query-center-x-input"
                        />
                    </Tooltip>
                    <Tooltip content={`Format: ${this.getLocalFormatLabel('y')}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <SafeNumericInput
                            allowNumericCharactersOnly={false}
                            buttonPosition="none"
                            placeholder="Y WCS coordinate"
                            disabled={!wcsInfo || !centerWcsPoint || disable}
                            value={centerWcsPoint ? centerWcsPoint.y : ""}
                            onBlur={this.handleCenterWcsYChange}
                            onKeyDown={this.handleCenterWcsYChange}
                            data-testid="catalog-query-center-y-input"
                        />
                    </Tooltip>
                    <Tooltip content="Reset to current view center" disabled={disable} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <Button icon="locate" disabled={disable} onClick={() => configStore.setFrameCenter()} data-testid="catalog-query-reset-center-button" />
                    </Tooltip>
                </FormGroup>
                {/* <FormGroup inline={true} label="Coordinate format" disabled={disable}>
                    <RadioGroup
                        onChange={this.handleFormatToggle}
                        selectedValue={this.localCoordinateFormat}
                        disabled={disable}
                        inline={true}
                    >
                        <Radio value={LocalCoordinateFormat.Degrees} label="Degrees" />
                        <Radio value={LocalCoordinateFormat.HMSDMS} label="HMS/DMS" disabled={!this.supportsHmsDmsFormat()} />
                    </RadioGroup>
                </FormGroup> */}
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
            <div className="catalog-query-panel">
                <ScrollShadow>{configBoard}</ScrollShadow>
                <Overlay2 autoFocus={true} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={disable} usePortal={false}>
                    <div className="query-loading-overlay">
                        <Spinner intent={Intent.PRIMARY} size={30} value={null} />
                    </div>
                </Overlay2>
                <div className="query-footer">
                    <div className={"result-info"} data-testid="catalog-query-info">
                        {tableInfo}
                    </div>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.WARNING} disabled={!configStore.isQuerying} onClick={() => CatalogApiService.Instance.cancelQuery(configStore.catalogDB)} text={"Cancel"} />
                        {configStore.enableLoadVizier ? <AnchorButton intent={Intent.PRIMARY} disabled={disable} onClick={() => this.loadVizierCatalogs()} text={"Load selected"} /> : null}
                        <Tooltip content={"Please select WCS coordinates"} disabled={appStore.overlaySettings.isWcsCoordinates} position={Position.BOTTOM} hoverOpenDelay={300}>
                            <AnchorButton intent={Intent.SUCCESS} disabled={disable || appStore.overlaySettings.isImgCoordinates} onClick={() => this.query()} text={"Query"} />
                        </Tooltip>
                    </div>
                </div>
            </div>
        );
    }

    private query = async () => {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        if (configStore.catalogDB === CatalogDatabase.SIMBAD) {
            // In Simbad, the coordinate system parameter is never interpreted. All coordinates MUST be expressed in the ICRS coordinate system
            const centerCoord = configStore.convertToDeg(configStore.centerPixelCoordAsPoint2D, SystemType.ICRS, "10");
            const query = `SELECT Top ${configStore.maxObject} *, DISTANCE(POINT('ICRS', ${centerCoord.x},${centerCoord.y}), POINT('ICRS', ra, dec)) as dist FROM basic WHERE CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${centerCoord.x},${centerCoord.y},${configStore.radiusAsDeg}))=1 AND ra IS NOT NULL AND dec IS NOT NULL order by dist`;
            configStore.setQueryStatus(true);
            const dataSize = await CatalogApiService.Instance.appendSimbadCatalog(query);
            configStore.setQueryStatus(false);
            this.setResultSize(dataSize);
        } else if (configStore.catalogDB === CatalogDatabase.VIZIER) {
            configStore.setQueryStatus(true);
            configStore.resetVizier();
            const centerCoord = configStore.convertToDeg(configStore.centerPixelCoordAsPoint2D, SystemType.FK5, "10");
            const resources = await CatalogApiService.Instance.queryVizierTableName(centerCoord, configStore.searchRadius, configStore.radiusUnits, configStore.vizierKeyWords);
            configStore.setQueryStatus(false);
            configStore.setVizierQueryResult(resources);
            this.setResultSize(resources.size);
        }
    };

    private loadVizierCatalogs = async () => {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const sources = configStore.selectedVizierSource;
        const centerCoord = configStore.convertToDeg(configStore.centerPixelCoordAsPoint2D, SystemType.FK5, "10");
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
        return <MenuItem key={type} text={this.getSystemTypeKey(type)} onClick={itemProps.handleClick} />;
    };

    private getSystemTypeKey = (value: string): string => {
        // Special case: if SystemType.Image, display as SystemType.Auto
        if (value === SystemType.Image) {
            const global = AppStore.Instance.overlaySettings.global;
            global.setSystem(SystemType.Auto);
            return Object.keys(SystemType).find(key => SystemType[key] === SystemType.Auto);
        }
        return Object.keys(SystemType).find(key => SystemType[key] === value) || value;
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
        const centerWcsPoint = this.getLocalFormattedWCSPoint(wcsInfo, configStore.centerPixelCoordAsPoint2D);
        if (!centerWcsPoint) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === centerWcsPoint.x) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, this.getLocalFormatType('x'))) {
            // Parse using a temporary transform matching local format
            const tempTransform = AST.copy(wcsInfo);
            if (this.localCoordinateFormat === LocalCoordinateFormat.HMSDMS && this.supportsHmsDmsFormat()) {
                AST.set(tempTransform, "Format(1)=hms.10, Format(2)=dms.10");
            } else {
                AST.set(tempTransform, "Format(1)=d.10, Format(2)=d.10");
            }
            const newPoint = getPixelValueFromWCS(tempTransform, {x: wcsString, y: centerWcsPoint.y});
            AST.deleteObject(tempTransform);
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
        const centerWcsPoint = this.getLocalFormattedWCSPoint(wcsInfo, configStore.centerPixelCoordAsPoint2D);
        if (!centerWcsPoint) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === centerWcsPoint.y) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, this.getLocalFormatType('y'))) {
            // Parse using a temporary transform matching local format
            const tempTransform = AST.copy(wcsInfo);
            if (this.localCoordinateFormat === LocalCoordinateFormat.HMSDMS && this.supportsHmsDmsFormat()) {
                AST.set(tempTransform, "Format(1)=hms.10, Format(2)=dms.10");
            } else {
                AST.set(tempTransform, "Format(1)=d.10, Format(2)=d.10");
            }
            const newPoint = getPixelValueFromWCS(tempTransform, {x: centerWcsPoint.x, y: wcsString});
            AST.deleteObject(tempTransform);
            if (newPoint && isFinite(newPoint.y)) {
                configStore.updateCenterPixelCoord(newPoint);
                return;
            }
        }
        ev.currentTarget.value = centerWcsPoint.y;
    };

    private supportsHmsDmsFormat = (): boolean => {
        const appStore = AppStore.Instance;
        const currentSystem = appStore.overlaySettings.global.explicitSystem;

        // HMS/DMS format is only supported for equatorial coordinate systems
        return currentSystem === SystemType.FK4 ||
               currentSystem === SystemType.FK5 ||
               currentSystem === SystemType.ICRS;
    };

    private isHmsDmsFormat = (): boolean => {
        const appStore = AppStore.Instance;
        const formatX = appStore.overlaySettings.numbers.formatTypeX;
        const formatY = appStore.overlaySettings.numbers.formatTypeY;
        
        // Return true if using HMS/DMS format
        return formatX === NumberFormatType.HMS && formatY === NumberFormatType.DMS;
    };

    private handleFormatToggle = (event: React.FormEvent<HTMLInputElement>) => {
        const selectedValue = (event.target as HTMLInputElement).value as LocalCoordinateFormat;
        
        // Only change local format, don't affect global imageview settings
        if (selectedValue === LocalCoordinateFormat.HMSDMS && !this.supportsHmsDmsFormat()) {
            // If HMS/DMS not supported, stay with degrees
            this.setLocalCoordinateFormat(LocalCoordinateFormat.Degrees);
        } else {
            this.setLocalCoordinateFormat(selectedValue);
        }
    };

    private handleSystemTypeChange = (type: SystemType) => {
        const global = AppStore.Instance.overlaySettings.global;
        global.setSystem(type);
        
        // If switching to a system that doesn't support HMS/DMS, automatically switch local format to degrees
        if (!this.supportsHmsDmsFormat() && this.localCoordinateFormat === LocalCoordinateFormat.HMSDMS) {
            this.setLocalCoordinateFormat(LocalCoordinateFormat.Degrees);
        }
    };
}
