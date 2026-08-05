import * as React from "react";
import {AnchorButton, Button, Classes, ControlGroup, FormGroup, Icon, InputGroup, Intent, MenuItem, NonIdealState, Overlay2, PopoverNext, PopoverPosition, Position, Pre, Spinner, Tooltip} from "@blueprintjs/core";
import {type ItemRendererProps, MultiSelect, Select} from "@blueprintjs/select";
import FuzzySearch from "fuzzy-search";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {AppToaster, ClearableNumericInputComponent, ErrorToast, SafeNumericInput, ScrollShadow} from "components/Shared";
import {CatalogDatabase, PreferenceKeys, RadiusUnits, SystemType} from "enums";
import {type Point2D, type WCSPoint2D} from "models";
import {CatalogApiService} from "services";
import {AppStore, CatalogOnlineQueryConfigStore, PreferenceStore, type VizierItem} from "stores";
import {clamp, getFormattedWCSPoint, getPixelValueFromWCS, isWCSStringFormatValid, NUMBER_FORMAT_LABEL} from "utilities";

import "./CatalogOnlineQueryComponent.scss";

type MirrorBenchmarkStatus = "idle" | "pending" | "ok" | "fail";
type MirrorBenchmark = {status: MirrorBenchmarkStatus; ms?: number};

@observer
export class CatalogQueryComponent extends React.Component {
    @observable resultSize: number | undefined = undefined;
    @observable objectSize: number | undefined = undefined;
    @observable newMirrorUrl: string = "";
    @observable addMirrorError: string | undefined = undefined;
    @observable editingMirrorIndex: number | undefined = undefined;
    @observable editingMirrorValue: string = "";
    @observable dragSourceMirrorIndex: number | undefined = undefined;
    @observable dragOverMirrorIndex: number | undefined = undefined;
    @observable isBenchmarking: boolean = false;
    @observable mirrorBenchmarks: Map<string, MirrorBenchmark> = new Map();
    private mirrorBenchmarkAbort: AbortController | undefined = undefined;
    private lastMirrorSites: string[] = [];

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    componentDidUpdate() {
        this.syncMirrorBenchmarks();
    }

    componentWillUnmount() {
        this.cancelMirrorBenchmark();
    }

    @action setResultSize(resultSize: number | undefined) {
        this.resultSize = resultSize;
    }

    @action setObjectSize(objectSize: number | undefined) {
        this.objectSize = objectSize;
    }

    @computed get resultInfo(): string | undefined {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        if (configStore.isQuerying) {
            return `Querying ${configStore.catalogDB}`;
        } else if (configStore.isObjectQuerying) {
            return `Querying ${CatalogDatabase.SIMBAD}`;
        } else if (this.resultSize === 0) {
            return "No objects found";
        } else if (this.resultSize && this.resultSize >= 1) {
            if (configStore.catalogDB === CatalogDatabase.VIZIER) {
                return `Found ${this.resultSize} table(s)`;
            } else {
                return `Found ${this.resultSize} object(s)`;
            }
        } else if (this.objectSize === 0) {
            return `Object ${configStore.objectName} not found`;
        } else if (this.objectSize && this.objectSize >= 1) {
            return `Updated Center Coordinates according ${configStore.objectName}`;
        }
        return undefined;
    }

    public render() {
        const appStore = AppStore.Instance;
        const configStore = CatalogOnlineQueryConfigStore.Instance;

        if (!appStore || !appStore.activeFrame) {
            return <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />;
        }

        const isDisabled = configStore.isQuerying || configStore.isObjectQuerying;
        let sourceIndicater;
        let objectSize: number | undefined = this.objectSize;
        if (configStore.isObjectSearchDisabled) {
            objectSize = undefined;
        }

        if (objectSize === 0) {
            sourceIndicater = <Icon icon="cross" intent="warning" size={30} />;
        } else if (objectSize === 1) {
            sourceIndicater = <Icon icon="tick" intent="success" size={30} />;
        }

        const frame = appStore.activeFrame.spatialReference ?? appStore.activeFrame;
        const formatX = appStore.overlaySettings.numbers.formatTypeX;
        const formatY = appStore.overlaySettings.numbers.formatTypeY;
        const wcsInfo = frame.isValidWcs ? frame.wcsInfoForTransformation : 0;
        const centerWcsPoint = getFormattedWCSPoint(wcsInfo, configStore.centerPixelCoordAsPoint2D);
        const isVizier = configStore.catalogDB === CatalogDatabase.VIZIER;

        const mirrorSites = this.getMirrorSites(configStore.catalogDB);
        const activeMirror = mirrorSites[0];

        const configBoard = (
            <div className="online-catalog-config">
                <div className="catalog-db-row">
                    <FormGroup inline={false} label="Database" disabled={isDisabled}>
                        <Select
                            items={Object.values(CatalogDatabase)}
                            activeItem={null}
                            onItemSelect={db => configStore.setCatalogDB(db)}
                            itemRenderer={this.renderDBPopOver}
                            disabled={isDisabled}
                            popoverProps={{minimal: true}}
                            filterable={false}
                            resetOnSelect={true}
                        >
                            <Button className="database-select-button" text={configStore.catalogDB} disabled={isDisabled} endIcon="double-caret-vertical" />
                        </Select>
                    </FormGroup>
                    <FormGroup inline={false} label="Mirror site" disabled={isDisabled} className="mirror-site-group">
                        <ControlGroup>
                            <Select
                                items={mirrorSites}
                                activeItem={null}
                                onItemSelect={this.handleMirrorSelect}
                                itemRenderer={this.renderMirrorPopOver}
                                disabled={isDisabled}
                                popoverProps={{minimal: true}}
                                filterable={false}
                                resetOnSelect={true}
                            >
                                <Button className="mirror-select-button" text={this.getMirrorLabel(activeMirror)} disabled={isDisabled} endIcon="double-caret-vertical" />
                            </Select>
                            <PopoverNext
                                placement="bottom"
                                animation="minimal"
                                arrow={false}
                                content={
                                    <div className="mirror-manager">
                                        <div className="mirror-manager__header">
                                            <span className="mirror-manager__title">
                                                Mirror sites<span className="mirror-manager__count">{mirrorSites.length}</span>
                                            </span>
                                            <div className="mirror-manager__action-buttons">
                                                <Tooltip content="Reset to default mirrors" disabled={isDisabled} position={Position.BOTTOM} hoverOpenDelay={300}>
                                                    <Button icon="reset" variant="minimal" disabled={isDisabled} onClick={this.resetMirrorSites} aria-label="Reset to default mirrors" />
                                                </Tooltip>
                                                <Tooltip
                                                    content={this.isBenchmarking ? "Cancel speed test" : "Test all mirrors and sort by response time"}
                                                    disabled={isDisabled || mirrorSites.length === 0}
                                                    position={Position.BOTTOM}
                                                    hoverOpenDelay={300}
                                                >
                                                    <Button
                                                        variant="minimal"
                                                        intent={this.isBenchmarking ? Intent.DANGER : Intent.PRIMARY}
                                                        className={`mirror-manager__rank${this.isBenchmarking ? " is-loading" : ""}`}
                                                        icon={this.isBenchmarking ? "stop" : "dashboard"}
                                                        text={this.isBenchmarking ? "Cancel" : "Test speed"}
                                                        disabled={isDisabled || mirrorSites.length === 0}
                                                        onClick={this.runMirrorBenchmark}
                                                    />
                                                </Tooltip>
                                            </div>
                                        </div>
                                        <div className="mirror-manager__add-row">
                                            <InputGroup
                                                asyncControl={false}
                                                placeholder="Add new mirror URL..."
                                                disabled={isDisabled}
                                                intent={this.addMirrorError ? Intent.DANGER : Intent.NONE}
                                                value={this.newMirrorUrl}
                                                onChange={event => this.handleMirrorInputChange(event.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === "Enter") this.handleAddMirror();
                                                }}
                                                rightElement={<Button icon="plus" variant="minimal" disabled={isDisabled || !this.newMirrorUrl.trim()} onClick={this.handleAddMirror} intent={Intent.PRIMARY} aria-label="Add mirror" />}
                                            />
                                        </div>
                                        {this.addMirrorError ? <div className="mirror-manager__error">{this.addMirrorError}</div> : null}
                                        <div className="mirror-manager__separator" />
                                        <div className="mirror-manager__list">
                                            {mirrorSites.length === 0 ? <div className="mirror-manager__empty">No mirror sites. Add a URL above or reset to defaults.</div> : null}
                                            {mirrorSites.map((site, index) => {
                                                const benchmark = this.mirrorBenchmarks.get(site);
                                                const {label, resultStyle, status} = this.getMirrorBenchmarkDisplay(benchmark);
                                                const isDragOver = this.dragOverMirrorIndex === index;
                                                const isActive = index === 0;
                                                const isEditing = this.editingMirrorIndex === index;
                                                const isLastMirror = mirrorSites.length === 1;

                                                return (
                                                    <div
                                                        key={`${site}-${index}`}
                                                        className={`mirror-manager__item${isDragOver ? " is-drag-over" : ""}${isActive ? " is-active" : ""}`}
                                                        onDragOver={this.handleMirrorDragOver(index)}
                                                        onDrop={this.handleMirrorDrop(index)}
                                                        onDragEnd={this.handleMirrorDragEnd}
                                                    >
                                                        <Tooltip content="Drag to reorder" hoverOpenDelay={800} disabled={this.dragSourceMirrorIndex !== undefined}>
                                                            <Icon icon="drag-handle-vertical" className="mirror-manager__handle" draggable={!isDisabled} onDragStart={this.handleMirrorDragStart(index)} />
                                                        </Tooltip>
                                                        {isActive ? (
                                                            <Tooltip content="Current mirror" position={Position.TOP} hoverOpenDelay={300}>
                                                                <Icon icon="tick-circle" className="mirror-manager__active-icon" intent={Intent.SUCCESS} />
                                                            </Tooltip>
                                                        ) : (
                                                            <Tooltip content="Use this mirror" position={Position.TOP} hoverOpenDelay={300}>
                                                                <Button
                                                                    icon="circle"
                                                                    variant="minimal"
                                                                    size="small"
                                                                    className="mirror-manager__use-button"
                                                                    disabled={isDisabled}
                                                                    onClick={() => this.handleMirrorSelect(site)}
                                                                    aria-label="Use this mirror"
                                                                />
                                                            </Tooltip>
                                                        )}
                                                        {isEditing ? (
                                                            <InputGroup
                                                                autoFocus={true}
                                                                asyncControl={false}
                                                                disabled={isDisabled}
                                                                intent={this.isValidMirrorUrl(this.editingMirrorValue.trim()) ? Intent.NONE : Intent.DANGER}
                                                                value={this.editingMirrorValue}
                                                                onChange={event => this.setEditingMirrorValue(event.target.value)}
                                                                onKeyDown={e => {
                                                                    if (e.key === "Enter") this.commitMirrorEdit(index);
                                                                    else if (e.key === "Escape") this.cancelMirrorEdit();
                                                                }}
                                                                onBlur={() => this.commitMirrorEdit(index)}
                                                            />
                                                        ) : (
                                                            <div className="mirror-manager__url" title={site} onDoubleClick={isDisabled ? undefined : () => this.startMirrorEdit(index, site)}>
                                                                <span className="mirror-manager__url-host">{this.getMirrorLabel(site)}</span>
                                                                <span className="mirror-manager__url-path">{this.getMirrorPath(site)}</span>
                                                            </div>
                                                        )}
                                                        <div className={`mirror-manager__result is-${status}`} style={resultStyle}>
                                                            {this.renderBenchmarkResult(status, label)}
                                                        </div>
                                                        {!isEditing ? (
                                                            <Tooltip content="Edit URL" hoverOpenDelay={300}>
                                                                <Button icon="edit" variant="minimal" disabled={isDisabled} onClick={() => this.startMirrorEdit(index, site)} aria-label="Edit URL" />
                                                            </Tooltip>
                                                        ) : null}
                                                        <Tooltip content={isLastMirror ? "At least one mirror is required" : "Remove mirror"} hoverOpenDelay={300}>
                                                            <AnchorButton
                                                                icon="trash"
                                                                variant="minimal"
                                                                disabled={isDisabled || isLastMirror}
                                                                intent={Intent.DANGER}
                                                                onClick={() => this.handleRemoveMirror(index)}
                                                                aria-label="Remove mirror"
                                                            />
                                                        </Tooltip>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                }
                            >
                                <Button icon="cog" disabled={isDisabled} />
                            </PopoverNext>
                        </ControlGroup>
                    </FormGroup>
                    {isVizier ? (
                        <FormGroup inline={false} label="Keywords (catalog title)" disabled={isDisabled} className="keywords-group">
                            <InputGroup asyncControl={false} disabled={isDisabled} onChange={event => configStore.setVizierKeyWords(event.target.value)} value={configStore.vizierKeyWords} data-testid="catalog-query-keyword-input" />
                        </FormGroup>
                    ) : null}
                </div>
                <FormGroup inline={false} label="Object" disabled={isDisabled}>
                    <InputGroup asyncControl={false} disabled={isDisabled} rightElement={objectSize === undefined ? null : sourceIndicater} onChange={event => this.updateObjectName(event.target.value)} value={configStore.objectName} />
                    <Tooltip content="Reset center coordinates by object" disabled={isDisabled || configStore.isObjectSearchDisabled} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <Button disabled={isDisabled || configStore.isObjectSearchDisabled} text={"Resolve"} intent={Intent.NONE} onClick={this.handleObjectUpdate} />
                    </Tooltip>
                </FormGroup>
                <FormGroup inline={false} label="Search radius" disabled={isDisabled}>
                    <Tooltip content={`0 - ${configStore.maxRadius} ${configStore.radiusUnits}`} disabled={isDisabled} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <SafeNumericInput
                            asyncControl={true}
                            disabled={isDisabled}
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
                        disabled={isDisabled}
                        popoverProps={{minimal: true}}
                        filterable={false}
                        resetOnSelect={true}
                    >
                        <Button text={configStore.radiusUnits} disabled={isDisabled} endIcon="double-caret-vertical" />
                    </Select>
                    <Tooltip content="Reset center coordinates and search radius according current image viewer" disabled={isDisabled} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <Button disabled={isDisabled} onClick={() => configStore.resetSearchRadius()}>
                            Set to viewer
                        </Button>
                    </Tooltip>
                </FormGroup>
                <FormGroup inline={false} label="Center coordinates" disabled={isDisabled}>
                    <Select
                        items={Object.values(SystemType).filter(sys => sys !== SystemType.Image)}
                        activeItem={null}
                        onItemSelect={type => appStore.overlaySettings.global.setSystem(type)}
                        itemRenderer={this.renderSysTypePopOver}
                        disabled={isDisabled}
                        popoverProps={{minimal: true}}
                        filterable={false}
                        resetOnSelect={true}
                    >
                        <Button text={appStore.overlaySettings.global.system} disabled={isDisabled} endIcon="double-caret-vertical" />
                    </Select>
                    <Tooltip content={`Format: ${formatX ? NUMBER_FORMAT_LABEL.get(formatX) || "Unknown" : "Unknown"}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <SafeNumericInput
                            allowNumericCharactersOnly={false}
                            buttonPosition="none"
                            placeholder="X WCS coordinate"
                            disabled={!wcsInfo || !centerWcsPoint || isDisabled}
                            value={centerWcsPoint ? centerWcsPoint.x : ""}
                            onBlur={this.handleCenterWcsXChange}
                            onKeyDown={this.handleCenterWcsXChange}
                            data-testid="catalog-query-center-x-input"
                        />
                    </Tooltip>
                    <Tooltip content={`Format: ${formatY ? NUMBER_FORMAT_LABEL.get(formatY) || "Unknown" : "Unknown"}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <SafeNumericInput
                            allowNumericCharactersOnly={false}
                            buttonPosition="none"
                            placeholder="Y WCS coordinate"
                            disabled={!wcsInfo || !centerWcsPoint || isDisabled}
                            value={centerWcsPoint ? centerWcsPoint.y : ""}
                            onBlur={this.handleCenterWcsYChange}
                            onKeyDown={this.handleCenterWcsYChange}
                            data-testid="catalog-query-center-y-input"
                        />
                    </Tooltip>
                    <Tooltip content="Reset to current view center" disabled={isDisabled} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <Button icon="locate" disabled={isDisabled} onClick={() => configStore.setFrameCenter()} data-testid="catalog-query-reset-center-button" />
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
                    disabled={isDisabled}
                    inline={false}
                />
                {configStore.shouldShowVizierResult ? (
                    <FormGroup inline={false} label="VizieR catalog" disabled={isDisabled}>
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
                                onRemove: v => v && configStore.removeVizierSelectedTable(v.toString()),
                                rightElement: <Button icon="cross" variant="minimal" onClick={() => configStore.resetVizierSelectedTable()} />,
                                tagProps: {minimal: true}
                            }}
                        />
                    </FormGroup>
                ) : null}
            </div>
        );

        const tableInfo = <Pre>{this.resultInfo}</Pre>;

        return (
            <div className="catalog-query-panel">
                <ScrollShadow>{configBoard}</ScrollShadow>
                <Overlay2 autoFocus={true} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={isDisabled} usePortal={false}>
                    <div className="query-loading-overlay">
                        <Spinner intent={Intent.PRIMARY} size={30} />
                    </div>
                </Overlay2>
                <div className="query-footer">
                    <div className={"result-info"} data-testid="catalog-query-info">
                        {tableInfo}
                    </div>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.WARNING} disabled={!configStore.isQuerying} onClick={() => CatalogApiService.Instance.cancelQuery(configStore.catalogDB)} text={"Cancel"} />
                        {configStore.canLoadVizier ? <AnchorButton intent={Intent.PRIMARY} disabled={isDisabled} onClick={() => this.loadVizierCatalogs()} text={"Load selected"} /> : null}
                        <Tooltip content={"Please select WCS coordinates"} disabled={appStore.overlaySettings.isWcsCoordinates} position={Position.BOTTOM} hoverOpenDelay={300}>
                            <AnchorButton intent={Intent.SUCCESS} disabled={isDisabled || appStore.overlaySettings.isImgCoordinates} onClick={() => this.query()} text={"Query"} />
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
            const centerCoord = configStore.convertToDeg(configStore.centerPixelCoordAsPoint2D, SystemType.ICRS, CatalogOnlineQueryConfigStore.QUERY_DEG_PRECISION);
            const query = `SELECT Top ${configStore.maxObject} *, DISTANCE(POINT('ICRS', ${centerCoord.x},${centerCoord.y}), POINT('ICRS', ra, dec)) as dist FROM basic WHERE CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${centerCoord.x},${centerCoord.y},${configStore.radiusAsDeg}))=1 AND ra IS NOT NULL AND dec IS NOT NULL order by dist`;
            configStore.setQueryStatus(true);
            const dataSize = await CatalogApiService.Instance.appendSimbadCatalog(query);
            configStore.setQueryStatus(false);
            this.setResultSize(dataSize);
        } else if (configStore.catalogDB === CatalogDatabase.VIZIER) {
            configStore.setQueryStatus(true);
            configStore.resetVizier();
            const centerCoord = configStore.convertToDeg(configStore.centerPixelCoordAsPoint2D, SystemType.FK5, CatalogOnlineQueryConfigStore.QUERY_DEG_PRECISION);
            if (centerCoord.x && centerCoord.y) {
                const resources = await CatalogApiService.Instance.queryVizierTableName(centerCoord as WCSPoint2D, configStore.searchRadius, configStore.radiusUnits, configStore.vizierKeyWords);
                configStore.setQueryStatus(false);
                configStore.setVizierQueryResult(resources);
                this.setResultSize(resources.size);
            } else {
                configStore.setQueryStatus(false);
                this.setResultSize(0);
            }
        }
    };

    private loadVizierCatalogs = async () => {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const sources = configStore.selectedVizierSource.filter(source => source !== undefined);
        const centerCoord = configStore.convertToDeg(configStore.centerPixelCoordAsPoint2D, SystemType.FK5, CatalogOnlineQueryConfigStore.QUERY_DEG_PRECISION);
        if (centerCoord.x && centerCoord.y) {
            configStore.setQueryStatus(true);
            const resources = await CatalogApiService.Instance.queryVizierSource(centerCoord as WCSPoint2D, configStore.searchRadius, configStore.radiusUnits, configStore.maxObject, sources);
            CatalogApiService.Instance.appendVizierCatalog(resources);
            configStore.setQueryStatus(false);
        }
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
                        if (pixelCoord && pixelCoord.x !== undefined && pixelCoord.y !== undefined) {
                            configStore.updateCenterPixelCoord(pixelCoord as Point2D);
                        }
                    }
                }
            })
            .catch(error => {
                this.setObjectSize(0);
                configStore.setObjectQueryStatus(false);
                if (error?.message) {
                    AppToaster.show(ErrorToast(error.message));
                } else {
                    console.log(`Object search error ${error}`);
                }
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

    private getMirrorSites = (database: CatalogDatabase): string[] => {
        const preferences = PreferenceStore.Instance;
        return database === CatalogDatabase.SIMBAD ? preferences.catalogQuerySimbadMirrors : preferences.catalogQueryVizierMirrors;
    };

    private setMirrorSites = (database: CatalogDatabase, sites: string[]) => {
        const key = database === CatalogDatabase.SIMBAD ? PreferenceKeys.CATALOG_QUERY_SIMBAD_MIRRORS : PreferenceKeys.CATALOG_QUERY_VIZIER_MIRRORS;
        this.pruneMirrorBenchmarks(sites);
        PreferenceStore.Instance.setPreference(key, sites);
    };

    private resetMirrorSites = () => {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        this.cancelMirrorEdit();
        this.cancelMirrorBenchmark();
        const sites = configStore.catalogDB === CatalogDatabase.SIMBAD ? PreferenceStore.DefaultCatalogQuerySimbadMirrors : PreferenceStore.DefaultCatalogQueryVizierMirrors;
        this.setMirrorSites(configStore.catalogDB, sites);
    };

    private getMirrorLabel = (url: string): string => {
        if (!url) {
            return "Select mirror";
        }
        try {
            return new URL(url).host;
        } catch {
            return url;
        }
    };

    private handleMirrorSelect = (mirror: string) => {
        this.cancelMirrorEdit();
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const sites = [...this.getMirrorSites(configStore.catalogDB)];
        const nextSites = [mirror, ...sites.filter(item => item !== mirror)];
        this.setMirrorSites(configStore.catalogDB, nextSites);
    };

    @action private handleMirrorInputChange = (value: string) => {
        this.newMirrorUrl = value;
        this.addMirrorError = undefined;
    };

    private isValidMirrorUrl = (value: string): boolean => {
        try {
            const url = new URL(value);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch {
            return false;
        }
    };

    private getMirrorPath = (url: string): string => {
        try {
            const parsed = new URL(url);
            const path = `${parsed.pathname}${parsed.search}`;
            return path === "/" ? "" : path;
        } catch {
            return "";
        }
    };

    @action private handleAddMirror = () => {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const url = this.newMirrorUrl.trim();
        if (!url) {
            return;
        }
        if (!this.isValidMirrorUrl(url)) {
            this.addMirrorError = "Please enter a valid http(s) URL.";
            return;
        }
        const sites = [...this.getMirrorSites(configStore.catalogDB)];
        if (sites.includes(url)) {
            this.addMirrorError = "This mirror is already in the list.";
            return;
        }
        sites.push(url);
        this.setMirrorSites(configStore.catalogDB, sites);
        this.newMirrorUrl = "";
        this.addMirrorError = undefined;
    };

    private handleRemoveMirror = (index: number) => {
        this.cancelMirrorEdit();
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const sites = [...this.getMirrorSites(configStore.catalogDB)];
        sites.splice(index, 1);
        this.setMirrorSites(configStore.catalogDB, sites);
    };

    @action private startMirrorEdit = (index: number, value: string) => {
        this.editingMirrorIndex = index;
        this.editingMirrorValue = value;
    };

    @action private setEditingMirrorValue = (value: string) => {
        this.editingMirrorValue = value;
    };

    @action private cancelMirrorEdit = () => {
        this.editingMirrorIndex = undefined;
        this.editingMirrorValue = "";
    };

    @action private commitMirrorEdit = (index: number) => {
        if (this.editingMirrorIndex !== index) {
            return;
        }
        const value = this.editingMirrorValue.trim();
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const sites = [...this.getMirrorSites(configStore.catalogDB)];
        const isDuplicate = sites.some((site, i) => i !== index && site === value);
        if (this.isValidMirrorUrl(value) && !isDuplicate && value !== sites[index]) {
            sites[index] = value;
            this.setMirrorSites(configStore.catalogDB, sites);
        }
        this.cancelMirrorEdit();
    };

    private handleMirrorDragStart = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
        this.cancelMirrorEdit();
        this.dragSourceMirrorIndex = index;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", index.toString());

        // Set the entire item as drag image for better visual feedback
        const dragHandle = event.currentTarget;
        const itemElement = dragHandle.closest(".mirror-manager__item") as HTMLElement;
        if (itemElement) {
            event.dataTransfer.setDragImage(itemElement, 0, 0);
        }
    };

    private handleMirrorDragOver = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (this.dragOverMirrorIndex !== index) {
            this.dragOverMirrorIndex = index;
        }
    };

    private handleMirrorDrop = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const sites = [...this.getMirrorSites(configStore.catalogDB)];
        const fromIndex = this.dragSourceMirrorIndex ?? Number(event.dataTransfer.getData("text/plain"));
        if (!Number.isFinite(fromIndex) || fromIndex < 0 || fromIndex >= sites.length || fromIndex === index) {
            this.resetMirrorDragState();
            return;
        }
        const [moved] = sites.splice(fromIndex, 1);
        sites.splice(index, 0, moved);
        this.setMirrorSites(configStore.catalogDB, sites);
        this.resetMirrorDragState();
    };

    private handleMirrorDragEnd = () => {
        this.resetMirrorDragState();
    };

    private resetMirrorDragState = () => {
        this.dragSourceMirrorIndex = undefined;
        this.dragOverMirrorIndex = undefined;
    };

    @action private pruneMirrorBenchmarks = (sites: string[]) => {
        const allowed = new Set(sites);
        for (const key of Array.from(this.mirrorBenchmarks.keys())) {
            if (!allowed.has(key)) {
                this.mirrorBenchmarks.delete(key);
            }
        }
    };

    private formatBenchmarkMs = (ms: number): string => {
        if (!Number.isFinite(ms)) {
            return "";
        }
        if (ms >= 1000) {
            return `${(ms / 1000).toFixed(2)}s`;
        }
        return `${Math.round(ms)}ms`;
    };

    private getBenchmarkHue = (ms: number): number => {
        const ratio = Math.min(Math.max(ms / 10000, 0), 1);
        return Math.round(120 * (1 - ratio));
    };

    private getMirrorBenchmarkDisplay = (benchmark?: MirrorBenchmark): {label: string; resultStyle?: React.CSSProperties; status: MirrorBenchmarkStatus} => {
        if (!benchmark) {
            return {label: "—", status: "idle"};
        }

        if (benchmark.status === "pending") {
            return {label: "Testing…", status: "pending"};
        }

        if (benchmark.status === "fail") {
            return {label: "Failed", status: "fail"};
        }

        if (benchmark.status === "ok" && benchmark.ms !== undefined) {
            const hue = this.getBenchmarkHue(benchmark.ms);
            return {
                label: this.formatBenchmarkMs(benchmark.ms),
                resultStyle: {["--bench-hue" as any]: hue} as React.CSSProperties,
                status: "ok"
            };
        }

        return {label: "—", status: benchmark.status};
    };

    @action private runMirrorBenchmark = async () => {
        if (this.isBenchmarking) {
            this.cancelMirrorBenchmark();
            return;
        }
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const database = configStore.catalogDB;
        const sites = [...this.getMirrorSites(database)];
        if (sites.length === 0) {
            return;
        }

        this.mirrorBenchmarkAbort = new AbortController();
        this.isBenchmarking = true;
        sites.forEach(site => this.mirrorBenchmarks.set(site, {status: "pending"}));

        try {
            await Promise.all(
                sites.map(async site => {
                    const ms = await CatalogApiService.Instance.benchmarkMirror(database, site, 10000, this.mirrorBenchmarkAbort?.signal);
                    if (!this.isBenchmarking) {
                        return;
                    }
                    if (ms === null || !Number.isFinite(ms)) {
                        this.mirrorBenchmarks.set(site, {status: "fail"});
                    } else {
                        this.mirrorBenchmarks.set(site, {status: "ok", ms});
                    }
                })
            );
            if (this.isBenchmarking) {
                this.sortMirrorsByBenchmark(database);
            }
        } finally {
            this.isBenchmarking = false;
            this.mirrorBenchmarkAbort = undefined;
        }
    };

    private sortMirrorsByBenchmark = (database: CatalogDatabase) => {
        const sites = [...this.getMirrorSites(database)];
        sites.sort((a, b) => {
            const resultA = this.mirrorBenchmarks.get(a);
            const resultB = this.mirrorBenchmarks.get(b);
            const scoreA = this.getBenchmarkScore(resultA);
            const scoreB = this.getBenchmarkScore(resultB);
            return scoreA - scoreB;
        });
        this.setMirrorSites(database, sites);
    };

    private getBenchmarkScore = (result?: MirrorBenchmark): number => {
        switch (result?.status) {
            case "pending":
                return 1000000;
            case "ok":
                return result.ms ?? 2000000;
            case "fail":
                return 3000000;
            default:
                return 2000000;
        }
    };

    @action private cancelMirrorBenchmark = () => {
        if (!this.isBenchmarking) {
            return;
        }
        this.mirrorBenchmarkAbort?.abort();
        this.mirrorBenchmarkAbort = undefined;
        this.isBenchmarking = false;
        for (const [site, result] of this.mirrorBenchmarks.entries()) {
            if (result.status === "pending") {
                this.mirrorBenchmarks.set(site, {status: "idle"});
            }
        }
        this.sortMirrorsByBenchmark(CatalogOnlineQueryConfigStore.Instance.catalogDB);
    };

    private syncMirrorBenchmarks = () => {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const sites = this.getMirrorSites(configStore.catalogDB);
        if (!this.areMirrorListsEqual(this.lastMirrorSites, sites)) {
            this.pruneMirrorBenchmarks(sites);
            this.lastMirrorSites = [...sites];
        }
    };

    private areMirrorListsEqual = (first: string[], second: string[]): boolean => {
        return first.length === second.length && first.every((item, index) => item === second[index]);
    };

    private renderBenchmarkResult = (status: MirrorBenchmarkStatus, label: string): React.ReactNode => {
        switch (status) {
            case "pending":
                return <Spinner size={14} intent={Intent.PRIMARY} />;
            case "fail":
                return (
                    <Tooltip content="Connection failed" position="top">
                        <Icon icon="error" intent={Intent.DANGER} />
                    </Tooltip>
                );
            case "idle":
                return <Icon icon="minus" />;
            default:
                return label;
        }
    };

    private renderDBPopOver = (catalogDB: CatalogDatabase, itemProps: ItemRendererProps) => {
        return <MenuItem key={catalogDB} text={catalogDB} onClick={itemProps.handleClick} />;
    };

    private renderMirrorPopOver = (mirror: string, itemProps: ItemRendererProps) => {
        return <MenuItem key={`${mirror}-${itemProps.index}`} active={itemProps.modifiers.active} text={this.getMirrorLabel(mirror)} onClick={itemProps.handleClick} />;
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
                label={table.name || undefined}
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
        if (ev.type === "keydown" && ev.key !== "Enter") {
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
        if (ev.type === "keydown" && ev.key !== "Enter") {
            return;
        }

        const activeFrame = AppStore.Instance.activeFrame;
        if (!activeFrame) {
            return;
        }
        const frame = activeFrame.spatialReference ?? activeFrame;
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const wcsInfo = frame.isValidWcs ? frame.wcsInfoForTransformation : 0;
        const centerWcsPoint = getFormattedWCSPoint(wcsInfo, configStore.centerPixelCoordAsPoint2D);
        if (!centerWcsPoint) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === centerWcsPoint.x) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlaySettings.numbers.formatTypeX)) {
            const newPoint = getPixelValueFromWCS(wcsInfo, {x: wcsString, y: centerWcsPoint.y});
            if (newPoint && isFinite(newPoint.x)) {
                configStore.updateCenterPixelCoord(newPoint);
                return;
            }
        }
        ev.currentTarget.value = centerWcsPoint.x;
    };

    private handleCenterWcsYChange = ev => {
        if (ev.type === "keydown" && ev.key !== "Enter") {
            return;
        }

        const activeFrame = AppStore.Instance.activeFrame;
        if (!activeFrame) {
            return;
        }
        const frame = activeFrame.spatialReference ?? activeFrame;
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const wcsInfo = frame.isValidWcs ? frame.wcsInfoForTransformation : 0;
        const centerWcsPoint = getFormattedWCSPoint(wcsInfo, configStore.centerPixelCoordAsPoint2D);
        if (!centerWcsPoint) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === centerWcsPoint.y) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlaySettings.numbers.formatTypeY)) {
            const newPoint = getPixelValueFromWCS(wcsInfo, {x: centerWcsPoint.x, y: wcsString});
            if (newPoint && isFinite(newPoint.y)) {
                configStore.updateCenterPixelCoord(newPoint);
                return;
            }
        }
        ev.currentTarget.value = centerWcsPoint.y;
    };
}
