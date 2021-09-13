import * as React from "react";
import axios, {CancelTokenSource} from "axios";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, Button, FormGroup, IDialogProps, Intent, InputGroup, MenuItem, NonIdealState, Overlay, PopoverPosition, Spinner, Icon} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {IItemRendererProps, Select} from "@blueprintjs/select";
import {AppStore, CatalogOnlineQueryConfigStore, CatalogDatabase, HelpType, RadiusUnits} from "stores";
import {DraggableDialogComponent} from "components/Dialogs";
import {ClearableNumericInputComponent, SafeNumericInput} from "components/Shared";
import {CatalogSystemType} from "models";
import "./CatalogOnlineQueryDialogComponent.scss";
import {ApiService} from "services";

@observer
export class CatalogQueryDialogComponent extends React.Component {
    private static readonly DefaultWidth = 550;
    private static readonly DefaultHeight = 500;
    private static readonly DBMap = new Map<CatalogDatabase, {type: CatalogSystemType[]; prefix: string}>([
        [CatalogDatabase.SIMBAD, {type: [CatalogSystemType.ICRS], prefix: "https://simbad.u-strasbg.fr/simbad/sim-tap/sync?request=doQuery&lang=adql&format=json&query="}]
    ]);
    private cancelTokenSource: CancelTokenSource;

    @observable resultSize: number;
    @observable objectSize: number;

    constructor(props: any) {
        super(props);
        makeObservable(this);
        this.cancelTokenSource = axios.CancelToken.source();
        this.resultSize = undefined;
        this.objectSize = undefined;
    }

    @action setResultSize(resultSize: number) {
        console.log(resultSize)
        this.resultSize = resultSize;
    }

    @action setObjectSize(objectSize: number) {
        this.objectSize = objectSize;
    }

    @computed get resultInfo(): string {
        let resultStr = undefined;
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        if (configStore.isQuerying || configStore.isObjectQuerying) {
            resultStr = `Querying ${configStore.catalogDB}`;
        } else if (this.resultSize === 0) {
            resultStr = "No objects found";
        } else if (this.resultSize >= 1) {
            resultStr = `Found ${this.resultSize} object(s)`;
        } else if (this.objectSize === 0) {
            resultStr = `Object ${configStore.objectName} not found`;
        } else if (this.objectSize >= 1) {
            resultStr = `Updated Center Coordinates according ${configStore.objectName}`;
        }
        return resultStr;
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
                <DraggableDialogComponent
                    dialogProps={dialogProps}
                    helpType={HelpType.ONLINE_CATALOG_QUERY}
                    defaultWidth={CatalogQueryDialogComponent.DefaultWidth}
                    defaultHeight={CatalogQueryDialogComponent.DefaultHeight}
                    enableResizing={true}
                >
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                </DraggableDialogComponent>
            );
        }

        const disable = configStore.isQuerying || configStore.isObjectQuerying;
        let sourceIndicater;
        if (this.objectSize === 0) {
            sourceIndicater = <Icon icon="cross" intent="warning" iconSize={30} />;
        } else {
            sourceIndicater = <Icon icon="tick" intent="success" iconSize={30} />;
        }
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
                <FormGroup inline={false} label="Object" disabled={disable}>
                    <InputGroup asyncControl={false} disabled={disable} rightElement={this.objectSize === undefined ? null : sourceIndicater} onChange={event => this.updateObjectName(event.target.value)} value={configStore.objectName} />
                    <Tooltip2 content="Reset center coordinates by object" disabled={disable}>
                        <Button disabled={disable || configStore.disableObjectSearch} text={"Resolve"} intent={Intent.NONE} onClick={this.handleObjectUpdate} />
                    </Tooltip2>
                </FormGroup>
                <FormGroup inline={false} label="Search Radius" disabled={disable}>
                    <Tooltip2 content={`0 - ${configStore.maxRadius} ${configStore.radiusUnits}`} disabled={disable}>
                        <SafeNumericInput
                            disabled={disable}
                            min={0}
                            max={configStore.maxRadius}
                            clampValueOnBlur={true}
                            value={configStore.searchRadius}
                            stepSize={0.5}
                            onValueChange={(value: number) => configStore.setSearchRadius(value)}
                        />
                    </Tooltip2>
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
                    <Tooltip2 content="Reset Center Coordinates and Search Radius according current image viewer" disabled={disable}>
                        <Button disabled={disable} onClick={() => configStore.resetSearchRadius()}>
                            Set to Image
                        </Button>
                    </Tooltip2>
                </FormGroup>
                <FormGroup inline={false} label="Center Coordinates" disabled={disable}>
                    <Select
                        items={CatalogQueryDialogComponent.DBMap.get(configStore.catalogDB).type}
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
                        onValueChange={(valueAsNumber: number, valueAsString: string) => configStore.setCenterCoord(valueAsString, "X")}
                    />
                    <SafeNumericInput
                        buttonPosition={"none"}
                        placeholder="Dec"
                        disabled={disable}
                        value={configStore.centerCoord.y}
                        onValueChange={(valueAsNumber: number, valueAsString: string) => configStore.setCenterCoord(valueAsString, "Y")}
                    />
                    <Tooltip2 content="Reset to current view center" disabled={disable}>
                        <Button icon="locate" disabled={disable} onClick={() => configStore.setFrameCenter()} />
                    </Tooltip2>
                </FormGroup>
                <ClearableNumericInputComponent
                    label="Max Number of Objects"
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
            </div>
        );

        const tableInfo = <pre>{this.resultInfo}</pre>;

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
                <div className="bp3-dialog-body">{configBoard}</div>
                <Overlay autoFocus={true} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={disable} usePortal={false}>
                    <div className="query-loading-overlay">
                        <Spinner intent={Intent.PRIMARY} size={30} value={null} />
                    </div>
                </Overlay>
                <div className="bp3-dialog-footer">
                    <div className={"result-info"}>{tableInfo}</div>
                    <div className="bp3-dialog-footer-actions">
                        <AnchorButton intent={Intent.SUCCESS} disabled={disable} onClick={() => this.query()} text={"Query"} />
                        <AnchorButton intent={Intent.WARNING} disabled={!configStore.isQuerying} onClick={() => this.cancelQuery()} text={"Cancel"} />
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }

    private query = () => {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        // In Simbad, the coordinate system parameter is never interpreted. All coordinates MUST be expressed in the ICRS coordinate system
        const baseUrl = CatalogQueryDialogComponent.DBMap.get(configStore.catalogDB).prefix;
        const query = `SELECT Top ${configStore.maxObject} *, DISTANCE(POINT('ICRS', ${configStore.centerCoord.x},${configStore.centerCoord.y}), POINT('ICRS', ra, dec)) as dist FROM basic WHERE CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${configStore.centerCoord.x},${configStore.centerCoord.y},${configStore.radiusInDeg}))=1 AND ra IS NOT NULL AND dec IS NOT NULL order by dist`;
        configStore.setQueryStatus(true);
        AppStore.Instance.appendOnlineCatalog(baseUrl, query, this.cancelTokenSource)
            .then(dataSize => {
                configStore.setQueryStatus(false);
                this.setResultSize(dataSize);
            })
            .catch(error => {
                configStore.setQueryStatus(false);
                this.setResultSize(0);
                if (axios.isCancel(error)) {
                    this.cancelTokenSource = axios.CancelToken.source();
                }
            });
    };

    private cancelQuery = () => {
        this.cancelTokenSource.cancel("Query canceled");
    };

    private handleObjectUpdate = () => {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const baseUrl = CatalogQueryDialogComponent.DBMap.get(configStore.catalogDB).prefix;
        const query = `SELECT basic.* FROM ident JOIN basic ON ident.oidref = basic.oid WHERE id = '${configStore.objectName}'`;
        configStore.setObjectQueryStatus(true);

        ApiService.Instance.getSimbad(baseUrl, query, this.cancelTokenSource)
            .then(response => {
                configStore.setObjectQueryStatus(false);
                const size = response.data?.data?.length;
                this.setObjectSize(size);
                if (response.status === 200 && size) {
                    const i = this.getDataIndex("ra", response.data?.metadata);
                    const j = this.getDataIndex("dec", response.data?.metadata);
                    if (i && j && size) {
                        configStore.setCenterCoord(response.data?.data[0][i], "X");
                        configStore.setCenterCoord(response.data?.data[0][j], "Y");
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
