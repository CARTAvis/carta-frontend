import * as React from "react";
import {AnchorButton, Button, Classes, FormGroup, Icon, InputGroup, Intent, MenuItem, NonIdealState, Overlay2, PopoverNext, PopoverPosition, Position, Pre, Spinner, Switch, Tooltip} from "@blueprintjs/core";
import {type ItemRendererProps, MultiSelect, Select} from "@blueprintjs/select";
import FuzzySearch from "fuzzy-search";
import {action, computed, makeObservable, observable, runInAction} from "mobx";
import {observer} from "mobx-react";

import {AppToaster, ClearableNumericInputComponent, ErrorToast, SafeNumericInput, ScrollShadow} from "components/Shared";
import {CatalogDatabase, RadiusUnits, SystemType} from "enums";
import {type Point2D, type WCSPoint2D} from "models";
import {CatalogApiService} from "services";
import {AppStore, CatalogOnlineQueryConfigStore, PreferenceStore, type VizierItem} from "stores";
import {clamp, getFormattedWCSPoint, getPixelValueFromWCS, isWCSStringFormatValid, NUMBER_FORMAT_LABEL} from "utilities";

import "./CatalogOnlineQueryComponent.scss";

type MirrorBenchmarkStatus = "idle" | "pending" | "ok" | "fail" | "disabled";
type MirrorBenchmark = {status: MirrorBenchmarkStatus; ms?: number};

const MIRROR_BENCHMARK_TIMEOUT_MS = 10000;

@observer
export class CatalogQueryComponent extends React.Component {
    @observable resultSize: number | undefined = undefined;
    @observable objectSize: number | undefined = undefined;
    @observable dragSourceMirrorIndex: number | undefined = undefined;
    @observable dragOverMirrorIndex: number | undefined = undefined;
    @observable isBenchmarking: boolean = false;
    @observable mirrorBenchmarks: Map<string, MirrorBenchmark> = new Map();
    private mirrorBenchmarkAbort: AbortController | undefined = undefined;
    private mirrorBenchmarkDatabase: CatalogDatabase | undefined = undefined;

    constructor(props: any) {
        super(props);
        makeObservable(this);
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
        const activeMirror = this.getActiveMirror(configStore.catalogDB, mirrorSites);
        const hasAvailableMirror = activeMirror !== undefined;
        const isMirrorConfigDisabled = isDisabled || this.isBenchmarking;

        const configBoard = (
            <div className="online-catalog-config">
                <div className="catalog-db-row">
                    <FormGroup inline={false} label="Database" disabled={isMirrorConfigDisabled}>
                        <Select
                            items={Object.values(CatalogDatabase)}
                            activeItem={null}
                            onItemSelect={this.handleDatabaseSelect}
                            itemRenderer={this.renderDBPopOver}
                            disabled={isMirrorConfigDisabled}
                            popoverProps={{minimal: true}}
                            filterable={false}
                            resetOnSelect={true}
                        >
                            <Button className="database-select-button" text={configStore.catalogDB} disabled={isMirrorConfigDisabled} endIcon="double-caret-vertical" data-testid="catalog-query-database-select-button" />
                        </Select>
                    </FormGroup>
                    <FormGroup inline={false} label="Mirror site" disabled={isDisabled} className="mirror-site-group">
                        <div className="mirror-site-controls">
                            <PopoverNext placement="bottom-start" animation="minimal" arrow={false} content={this.renderMirrorManager(configStore.catalogDB, mirrorSites, isDisabled, isMirrorConfigDisabled, activeMirror)}>
                                <Button className="mirror-select-button" text={this.getMirrorLabel(activeMirror)} disabled={isMirrorConfigDisabled} endIcon="double-caret-vertical" data-testid="catalog-query-mirror-select-button" />
                            </PopoverNext>
                        </div>
                    </FormGroup>
                    {isVizier ? (
                        <FormGroup inline={false} label="Keywords (catalog title)" disabled={isDisabled} className="keywords-group">
                            <InputGroup asyncControl={false} disabled={isDisabled} onChange={event => configStore.setVizierKeyWords(event.target.value)} value={configStore.vizierKeyWords} data-testid="catalog-query-keyword-input" />
                        </FormGroup>
                    ) : null}
                </div>
                <FormGroup inline={false} label="Object" disabled={isDisabled}>
                    <InputGroup
                        asyncControl={false}
                        disabled={isDisabled}
                        rightElement={objectSize === undefined ? null : sourceIndicater}
                        onChange={event => this.updateObjectName(event.target.value)}
                        value={configStore.objectName}
                        data-testid="catalog-query-object-name-input"
                    />
                    <Tooltip
                        content={hasAvailableMirror ? "Reset center coordinates by object" : "Enable at least one mirror site"}
                        disabled={isDisabled || configStore.isObjectSearchDisabled}
                        position={Position.BOTTOM}
                        hoverOpenDelay={300}
                    >
                        <Button disabled={isDisabled || !hasAvailableMirror || configStore.isObjectSearchDisabled} text={"Resolve"} intent={Intent.NONE} onClick={this.handleObjectUpdate} data-testid="catalog-query-resolve-button" />
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
                        <Button text={configStore.radiusUnits} disabled={isDisabled} endIcon="double-caret-vertical" data-testid="catalog-query-radius-units-button" />
                    </Select>
                    <Tooltip content="Reset center coordinates and search radius according current image viewer" disabled={isDisabled} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <Button disabled={isDisabled} onClick={() => configStore.resetSearchRadius()} data-testid="catalog-query-set-to-viewer-button">
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
                        <Button text={appStore.overlaySettings.global.system} disabled={isDisabled} endIcon="double-caret-vertical" data-testid="catalog-query-coordinate-system-button" />
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
                    data-testid="catalog-query-max-objects-input"
                />
                {configStore.shouldShowVizierResult ? (
                    <FormGroup inline={false} label="VizieR catalog" disabled={isDisabled}>
                        <MultiSelect
                            placeholder={"Please select catalog tables"}
                            fill={true}
                            popoverProps={{popoverClassName: "vizier-mulit-select", minimal: true, position: PopoverPosition.TOP}}
                            items={configStore.vizierTable}
                            itemRenderer={this.vizierItemRenderer}
                            onItemSelect={item => configStore.toggleVizierSelectedTable(item)}
                            selectedItems={configStore.vizierSelectedTableName}
                            tagRenderer={item => item.name}
                            itemPredicate={this.filterVizierTable}
                            noResults={<MenuItem disabled={true} text="No results." />}
                            tagInputProps={{
                                rightElement: <Button icon="cross" variant="minimal" onClick={() => configStore.resetVizierSelectedTable()} data-testid="catalog-query-clear-vizier-selection-button" />,
                                tagProps: (_tag, index) => ({
                                    minimal: true,
                                    className: "vizier-catalog-tag",
                                    onClickCapture: event => {
                                        const target = event.target as Element;
                                        if (!target.closest(`.${Classes.TAG_REMOVE}`)) {
                                            event.stopPropagation();
                                        }
                                    },
                                    onRemove: event => {
                                        event.stopPropagation();
                                        const item = configStore.vizierSelectedTableName[index];
                                        if (item?.name) {
                                            configStore.removeVizierSelectedTable(item.name);
                                        }
                                    }
                                })
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
                        <AnchorButton intent={Intent.WARNING} disabled={!configStore.isQuerying} onClick={() => CatalogApiService.Instance.cancelQuery(configStore.catalogDB)} text={"Cancel"} data-testid="catalog-query-cancel-button" />
                        {configStore.canLoadVizier ? (
                            <AnchorButton intent={Intent.PRIMARY} disabled={isDisabled || !hasAvailableMirror} onClick={() => this.loadVizierCatalogs()} text={"Load selected"} data-testid="catalog-query-load-selected-button" />
                        ) : null}
                        <Tooltip
                            content={hasAvailableMirror ? "Please select WCS coordinates" : "Enable at least one mirror site"}
                            disabled={hasAvailableMirror && appStore.overlaySettings.isWcsCoordinates}
                            position={Position.BOTTOM}
                            hoverOpenDelay={300}
                        >
                            <AnchorButton
                                intent={Intent.SUCCESS}
                                disabled={isDisabled || !hasAvailableMirror || appStore.overlaySettings.isImgCoordinates}
                                onClick={() => this.query()}
                                text={"Query"}
                                data-testid="catalog-query-query-button"
                            />
                        </Tooltip>
                    </div>
                </div>
            </div>
        );
    }

    private renderMirrorManager = (database: CatalogDatabase, mirrorSites: string[], isQueryDisabled: boolean, isMirrorConfigDisabled: boolean, activeMirror?: string) => {
        const availableMirrorCount = mirrorSites.filter(site => !this.isMirrorUnavailable(database, site)).length;
        const isBenchmarkButtonDisabled = isQueryDisabled || (!this.isBenchmarking && availableMirrorCount === 0);
        return (
            <div className="mirror-manager">
                <div className="mirror-manager__header">
                    <span className="mirror-manager__title">
                        Mirror sites
                        <span className="mirror-manager__count">
                            {availableMirrorCount}/{mirrorSites.length} enabled
                        </span>
                    </span>
                    <div className="mirror-manager__action-buttons">
                        <Tooltip content="Reset mirror settings" disabled={isMirrorConfigDisabled} position={Position.BOTTOM} hoverOpenDelay={300}>
                            <Button icon="reset" variant="minimal" disabled={isMirrorConfigDisabled} onClick={this.resetMirrorSites} aria-label="Reset mirror settings" data-testid="catalog-query-reset-mirrors-button" />
                        </Tooltip>
                        <Tooltip content={this.isBenchmarking ? "Cancel speed test" : "Test all enabled mirrors"} disabled={isBenchmarkButtonDisabled} position={Position.BOTTOM} hoverOpenDelay={300}>
                            <Button
                                variant="minimal"
                                intent={this.isBenchmarking ? Intent.DANGER : Intent.PRIMARY}
                                className={`mirror-manager__rank${this.isBenchmarking ? " is-loading" : ""}`}
                                icon={this.isBenchmarking ? "stop" : "dashboard"}
                                text={this.isBenchmarking ? "Cancel" : "Test speed"}
                                disabled={isBenchmarkButtonDisabled}
                                onClick={this.runMirrorBenchmark}
                                data-testid="catalog-query-test-mirror-speed-button"
                            />
                        </Tooltip>
                    </div>
                </div>
                <div className="mirror-manager__separator" />
                <div className="mirror-manager__list">{mirrorSites.map((site, index) => this.renderMirrorSite(database, site, index, availableMirrorCount, isMirrorConfigDisabled, activeMirror))}</div>
            </div>
        );
    };

    private renderMirrorSite = (database: CatalogDatabase, site: string, index: number, availableMirrorCount: number, isMirrorConfigDisabled: boolean, activeMirror?: string) => {
        const isMirrorBlocked = this.isMirrorBlocked(site);
        const isMirrorUserDisabled = this.isMirrorUserDisabled(database, site);
        const isMirrorUnavailable = isMirrorBlocked || isMirrorUserDisabled;
        const {label, resultStyle, status} = this.getMirrorBenchmarkDisplay(this.mirrorBenchmarks.get(this.getMirrorBenchmarkKey(database, site)), isMirrorBlocked, isMirrorUserDisabled);
        const isActive = site === activeMirror;
        const isLastAvailableMirror = !isMirrorUnavailable && availableMirrorCount === 1;
        const isToggleDisabled = isMirrorConfigDisabled || isMirrorBlocked || (!isMirrorUserDisabled && isLastAvailableMirror);
        const toggleTooltip = isMirrorBlocked ? "Unavailable on secure pages" : isMirrorUserDisabled ? "Enable mirror" : isLastAvailableMirror ? "At least one mirror must remain enabled" : "Disable mirror";
        const itemClassName = `mirror-manager__item${this.dragOverMirrorIndex === index ? " is-drag-over" : ""}${isActive ? " is-active" : ""}${isMirrorUnavailable ? " is-disabled" : ""}`;

        return (
            <div key={`${site}-${index}`} className={itemClassName} onDragOver={this.handleMirrorDragOver(index)} onDrop={this.handleMirrorDrop(index)} onDragEnd={this.handleMirrorDragEnd}>
                <Tooltip content="Drag to reorder" hoverOpenDelay={800} disabled={this.dragSourceMirrorIndex !== undefined}>
                    <Icon icon="drag-handle-vertical" className="mirror-manager__handle" draggable={!isMirrorConfigDisabled && !isMirrorUnavailable} onDragStart={this.handleMirrorDragStart(index)} />
                </Tooltip>
                <span className="mirror-manager__active-slot">
                    {isActive ? (
                        <Tooltip content="Current mirror" position={Position.TOP} hoverOpenDelay={300}>
                            <Icon icon="tick-circle" className="mirror-manager__active-icon" intent={Intent.SUCCESS} />
                        </Tooltip>
                    ) : (
                        <Tooltip content={isMirrorUnavailable ? "Unavailable mirror" : "Use this mirror"} position={Position.TOP} hoverOpenDelay={300}>
                            <Button
                                icon="circle"
                                variant="minimal"
                                size="small"
                                className="mirror-manager__use-button"
                                disabled={isMirrorConfigDisabled || isMirrorUnavailable}
                                onClick={() => this.handleMirrorSelect(database, site)}
                                aria-label="Use this mirror"
                                data-testid={`catalog-query-use-mirror-button-${index}`}
                            />
                        </Tooltip>
                    )}
                </span>
                <Button
                    variant="minimal"
                    className="mirror-manager__url"
                    disabled={isMirrorConfigDisabled || isMirrorUnavailable}
                    onClick={() => this.handleMirrorSelect(database, site)}
                    aria-label={`Use ${this.getMirrorLabel(site)} mirror`}
                    title={site}
                >
                    <span className="mirror-manager__url-host">{this.getMirrorLabel(site)}</span>
                </Button>
                <div className={`mirror-manager__result is-${status}`} style={resultStyle}>
                    {this.renderBenchmarkResult(status, label)}
                </div>
                <Tooltip content={toggleTooltip} hoverOpenDelay={300}>
                    <Switch
                        className="mirror-manager__toggle"
                        checked={!isMirrorUnavailable}
                        disabled={isToggleDisabled}
                        aria-label={isMirrorUnavailable ? "Enable mirror" : "Disable mirror"}
                        onChange={() => this.handleMirrorToggle(database, site)}
                        data-testid={`catalog-query-toggle-mirror-button-${index}`}
                    />
                </Tooltip>
            </div>
        );
    };

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
        const objectName = configStore.objectName.replace(/'/g, "''");
        const query = `SELECT basic.* FROM ident JOIN basic ON ident.oidref = basic.oid WHERE id = '${objectName}'`;
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
        const mirrors = PreferenceStore.Instance.getCatalogQueryMirrors(database);
        return [...mirrors].sort((first, second) => {
            const isFirstUnavailable = this.isMirrorUnavailable(database, first);
            const isSecondUnavailable = this.isMirrorUnavailable(database, second);
            if (isFirstUnavailable !== isSecondUnavailable) {
                return Number(isFirstUnavailable) - Number(isSecondUnavailable);
            }
            if (isFirstUnavailable) {
                return this.getMirrorLabel(first).localeCompare(this.getMirrorLabel(second));
            }
            return 0;
        });
    };

    private isMirrorBlocked = (mirror: string): boolean => {
        return PreferenceStore.Instance.isCatalogQueryMirrorDisabled(mirror);
    };

    private isMirrorUserDisabled = (database: CatalogDatabase, mirror: string): boolean => {
        return PreferenceStore.Instance.isCatalogQueryMirrorUserDisabled(database, mirror);
    };

    private isMirrorUnavailable = (database: CatalogDatabase, mirror: string): boolean => {
        return this.isMirrorBlocked(mirror) || this.isMirrorUserDisabled(database, mirror);
    };

    private getActiveMirror = (database: CatalogDatabase, mirrorSites: string[]): string | undefined => {
        const selectedMirror = PreferenceStore.Instance.getCatalogQueryActiveMirror(database);
        if (selectedMirror && mirrorSites.includes(selectedMirror) && !this.isMirrorUnavailable(database, selectedMirror)) {
            return selectedMirror;
        }
        return mirrorSites.find(site => !this.isMirrorUnavailable(database, site));
    };

    private resetMirrorSites = () => {
        const database = CatalogOnlineQueryConfigStore.Instance.catalogDB;
        this.cancelMirrorBenchmark();
        PreferenceStore.Instance.resetCatalogQueryMirrorSettings(database);
        this.pruneMirrorBenchmarks(database, this.getMirrorSites(database));
    };

    private getMirrorLabel = (url?: string): string => {
        if (!url) {
            return "Select mirror";
        }
        try {
            return new URL(url).host;
        } catch {
            return url;
        }
    };

    private handleDatabaseSelect = (database: CatalogDatabase) => {
        if (!this.isBenchmarking) {
            CatalogOnlineQueryConfigStore.Instance.setCatalogDB(database);
        }
    };

    private setMirrorSiteOrder = (database: CatalogDatabase, mirrors: string[]) => {
        this.pruneMirrorBenchmarks(database, mirrors);
        PreferenceStore.Instance.setCatalogQueryEnabledMirrors(
            database,
            mirrors.filter(mirror => !this.isMirrorUnavailable(database, mirror))
        );
    };

    private handleMirrorSelect = (database: CatalogDatabase, mirror: string) => {
        if (this.isMirrorUnavailable(database, mirror) || this.isBenchmarking) {
            return;
        }
        PreferenceStore.Instance.setCatalogQueryActiveMirror(database, mirror);
    };

    private handleMirrorToggle = (database: CatalogDatabase, mirror: string) => {
        const sites = this.getMirrorSites(database);
        const isUserDisabled = this.isMirrorUserDisabled(database, mirror);
        const availableMirrorCount = sites.filter(site => !this.isMirrorUnavailable(database, site)).length;
        if (!isUserDisabled && availableMirrorCount <= 1) {
            return;
        }
        PreferenceStore.Instance.toggleCatalogQueryMirrorDisabled(database, mirror);

        if (isUserDisabled) {
            const enabledMirrors = sites.filter(site => site !== mirror && !this.isMirrorUnavailable(database, site));
            this.pruneMirrorBenchmarks(database, sites);
            PreferenceStore.Instance.setCatalogQueryEnabledMirrors(database, [...enabledMirrors, mirror]);
        }
    };

    private handleMirrorDragStart = (index: number) =>
        action((event: React.DragEvent<HTMLElement>) => {
            this.dragSourceMirrorIndex = index;
            this.dragOverMirrorIndex = index;
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", index.toString());

            const itemElement = event.currentTarget.closest(".mirror-manager__item") as HTMLElement | null;
            if (itemElement) {
                event.dataTransfer.setDragImage(itemElement, 0, 0);
            }
        });

    private handleMirrorDragOver = (index: number) =>
        action((event: React.DragEvent<HTMLDivElement>) => {
            if (this.dragSourceMirrorIndex === undefined) {
                return;
            }
            event.preventDefault();
            if (this.dragOverMirrorIndex !== index) {
                this.dragOverMirrorIndex = index;
            }
        });

    private handleMirrorDrop = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const database = CatalogOnlineQueryConfigStore.Instance.catalogDB;
        const mirrors = [...this.getMirrorSites(database)];
        const fromIndex = this.dragSourceMirrorIndex ?? Number(event.dataTransfer.getData("text/plain"));
        if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= mirrors.length || fromIndex === index) {
            this.resetMirrorDragState();
            return;
        }

        const [movedMirror] = mirrors.splice(fromIndex, 1);
        if (movedMirror === undefined) {
            this.resetMirrorDragState();
            return;
        }
        mirrors.splice(index, 0, movedMirror);
        this.setMirrorSiteOrder(database, mirrors);
        this.resetMirrorDragState();
    };

    private handleMirrorDragEnd = () => {
        this.resetMirrorDragState();
    };

    @action private resetMirrorDragState = () => {
        this.dragSourceMirrorIndex = undefined;
        this.dragOverMirrorIndex = undefined;
    };

    private getMirrorBenchmarkKey = (database: CatalogDatabase, site: string): string => {
        return `${database}:${site}`;
    };

    @action private pruneMirrorBenchmarks = (database: CatalogDatabase, sites: string[]) => {
        const allowed = new Set(sites.map(site => this.getMirrorBenchmarkKey(database, site)));
        const databasePrefix = `${database}:`;
        for (const key of this.mirrorBenchmarks.keys()) {
            if (key.startsWith(databasePrefix) && !allowed.has(key)) {
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

    private getMirrorBenchmarkDisplay = (benchmark?: MirrorBenchmark, isBlocked: boolean = false, isUserDisabled: boolean = false): {label: string; resultStyle?: React.CSSProperties; status: MirrorBenchmarkStatus} => {
        if (isBlocked) {
            return {label: "Blocked on HTTPS", status: "disabled"};
        }
        if (isUserDisabled) {
            return {label: "Disabled", status: "disabled"};
        }
        if (!benchmark) {
            return {label: "—", status: "idle"};
        }

        switch (benchmark.status) {
            case "pending":
                return {label: "Testing…", status: "pending"};
            case "fail":
                return {label: "Failed", status: "fail"};
            case "ok":
                if (benchmark.ms !== undefined) {
                    const hue = this.getBenchmarkHue(benchmark.ms);
                    return {
                        label: this.formatBenchmarkMs(benchmark.ms),
                        resultStyle: {["--bench-hue" as any]: hue} as React.CSSProperties,
                        status: "ok"
                    };
                }
                break;
            case "disabled":
                return {label: "—", status: "idle"};
            default:
                return {label: "—", status: benchmark.status};
        }

        return {label: "—", status: "ok"};
    };

    @action private runMirrorBenchmark = async () => {
        if (this.isBenchmarking) {
            this.cancelMirrorBenchmark(true);
            return;
        }
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const database = configStore.catalogDB;
        const sites = [...this.getMirrorSites(database)];
        const testableSites = sites.filter(site => !this.isMirrorUnavailable(database, site));
        if (testableSites.length === 0) {
            return;
        }

        const abortController = new AbortController();
        this.mirrorBenchmarkAbort = abortController;
        this.mirrorBenchmarkDatabase = database;
        this.isBenchmarking = true;
        const testableSiteSet = new Set(testableSites);
        sites.forEach(site => this.mirrorBenchmarks.set(this.getMirrorBenchmarkKey(database, site), {status: testableSiteSet.has(site) ? "pending" : "disabled"}));

        try {
            await Promise.all(
                testableSites.map(async site => {
                    const ms = await CatalogApiService.Instance.benchmarkMirror(database, site, MIRROR_BENCHMARK_TIMEOUT_MS, abortController.signal);
                    runInAction(() => {
                        if (!this.isBenchmarking || this.mirrorBenchmarkAbort !== abortController) {
                            return;
                        }
                        if (ms === null || !Number.isFinite(ms)) {
                            this.mirrorBenchmarks.set(this.getMirrorBenchmarkKey(database, site), {status: "fail"});
                        } else {
                            this.mirrorBenchmarks.set(this.getMirrorBenchmarkKey(database, site), {status: "ok", ms});
                        }
                    });
                })
            );
            if (this.isBenchmarking && this.mirrorBenchmarkAbort === abortController) {
                this.sortMirrorsByBenchmark(database);
            }
        } finally {
            runInAction(() => {
                if (this.mirrorBenchmarkAbort === abortController) {
                    this.isBenchmarking = false;
                    this.mirrorBenchmarkAbort = undefined;
                    this.mirrorBenchmarkDatabase = undefined;
                }
            });
        }
    };

    private sortMirrorsByBenchmark = (database: CatalogDatabase) => {
        const mirrors = [...this.getMirrorSites(database)];
        mirrors.sort((first, second) => {
            const firstScore = this.getBenchmarkScore(this.mirrorBenchmarks.get(this.getMirrorBenchmarkKey(database, first)));
            const secondScore = this.getBenchmarkScore(this.mirrorBenchmarks.get(this.getMirrorBenchmarkKey(database, second)));
            return firstScore - secondScore;
        });
        this.setMirrorSiteOrder(database, mirrors);
    };

    private getBenchmarkScore = (benchmark?: MirrorBenchmark): number => {
        switch (benchmark?.status) {
            case "pending":
                return 1000000;
            case "ok":
                return benchmark.ms ?? 2000000;
            case "fail":
                return 3000000;
            case "disabled":
                return 4000000;
            default:
                return 2000000;
        }
    };

    @action private cancelMirrorBenchmark = (shouldSortByBenchmark: boolean = false) => {
        if (!this.isBenchmarking) {
            return;
        }
        const database = this.mirrorBenchmarkDatabase;
        this.mirrorBenchmarkAbort?.abort();
        this.mirrorBenchmarkAbort = undefined;
        this.mirrorBenchmarkDatabase = undefined;
        this.isBenchmarking = false;
        if (database !== undefined) {
            for (const site of this.getMirrorSites(database)) {
                const key = this.getMirrorBenchmarkKey(database, site);
                const result = this.mirrorBenchmarks.get(key);
                if (result?.status === "pending") {
                    this.mirrorBenchmarks.set(key, {status: "idle"});
                }
            }
            if (shouldSortByBenchmark) {
                this.sortMirrorsByBenchmark(database);
            }
        }
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
            case "disabled":
                return (
                    <Tooltip content={label} position="top">
                        <Icon icon="disable" intent={Intent.NONE} aria-label={label} />
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
