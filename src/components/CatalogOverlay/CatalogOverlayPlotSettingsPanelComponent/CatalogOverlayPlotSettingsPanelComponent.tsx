import * as React from "react";
import {AnchorButton, Button, ButtonGroup, Classes, Collapse, Colors, FormGroup, Icon, MenuItem, PopoverPosition, Switch, Tab, Tabs, Tooltip} from "@blueprintjs/core";
import {type ItemPredicate, type ItemRendererProps, Select} from "@blueprintjs/select";
import FuzzySearch from "fuzzy-search";
import {action, autorun, computed, type IReactionDisposer, makeObservable} from "mobx";
import {observer} from "mobx-react";

import {AutoColorPickerComponent, ClearableNumericInputComponent, ColormapComponent, SafeNumericInput, ScalingSelectComponent, ScrollShadow} from "components/Shared";
import {AngularSizeUnit, CatalogDisplayMode, CatalogOverlay, CatalogOverlayShape, CatalogSettingsTabs, CatalogSizeUnits, HelpType} from "enums";
import {AppStore, type CatalogOnlineQueryProfileStore, type CatalogProfileStore, CatalogStore, type DefaultWidgetConfig, type WidgetProps, WidgetsStore} from "stores";
import {CatalogWidgetStore, type ValueClip} from "stores/Widgets";
import {getColorForTheme, isCatalogAxisDataType, SWATCH_COLORS} from "utilities";

import "./CatalogOverlayPlotSettingsPanelComponent.scss";

const IconWrapper = (path: React.ReactNode, color: string, fill: boolean, strokeWidth = 2, viewboxDefault = 16) => {
    let fillColor = color;
    if (!fill) {
        fillColor = "none";
    }
    return (
        <span className={Classes.ICON}>
            <svg data-icon="triangle-up-open" width="16" height="16" viewBox={`0 0 ${viewboxDefault} ${viewboxDefault}`} style={{stroke: color, fill: fillColor, strokeWidth: strokeWidth}}>
                {path}
            </svg>
        </span>
    );
};

const TRIANGLE_UP = <path d="M 2 14 L 14 14 L 8 3 Z" />;
const TRIANGLE_DOWN = <path d="M 2 2 L 14 2 L 8 13 Z" />;
const RHOMB = <path d="M 8 14 L 14 8 L 8 2 L 2 8 Z" />;
const HEXAGON2 = <path d="M 12.33 5.5 L 12.33 10.5 L 8 13 L 3.67 10.5 L 3.67 5.5 L 8 3 Z" />;
const HEXAGON = <path d="M 3 8 L 5.5 3.67 L 10.5 3.67 L 13 8 L 10.5 12.33 L 5.5 12.33 Z" />;
const ELLIPSE = <ellipse cx="8" cy="8" rx="4" ry="7" />;
const KEYCODE_ENTER = 13;

@observer
export class CatalogOverlayPlotSettingsPanelComponent extends React.Component<WidgetProps> {
    private catalogFileNames: Map<number, string>;
    private widgetId: string;
    private floatingSettingsId: string | undefined;
    private readonly disposers: IReactionDisposer[] = [];
    private catalogOverlayShape: Array<CatalogOverlayShape> = [
        CatalogOverlayShape.BOX_LINED,
        CatalogOverlayShape.CIRCLE_FILLED,
        CatalogOverlayShape.CIRCLE_LINED,
        CatalogOverlayShape.CROSS_FILLED,
        CatalogOverlayShape.ELLIPSE_LINED,
        CatalogOverlayShape.HEXAGON_LINED,
        CatalogOverlayShape.HEXAGON_LINED_2,
        CatalogOverlayShape.RHOMB_LINED,
        CatalogOverlayShape.TRIANGLE_LINED_DOWN,
        CatalogOverlayShape.TRIANGLE_LINED_UP,
        CatalogOverlayShape.X_FILLED,
        CatalogOverlayShape.LineSegment_FILLED
    ];

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "catalog-overlay-floating-settings",
            type: "floating-settings",
            minWidth: 420,
            minHeight: 250,
            defaultWidth: 420,
            defaultHeight: 560,
            title: "catalog-overlay-settings",
            isCloseable: true,
            parentId: "catalog-overlay",
            parentType: "catalog-overlay",
            helpType: [HelpType.CATALOG_SETTINGS_GOLBAL, HelpType.CATALOG_SETTINGS_OVERLAY, HelpType.CATALOG_SETTINGS_COLOR, HelpType.CATALOG_SETTINGS_SIZE, HelpType.CATALOG_SETTINGS_ORIENTATION]
        };
    }

    @computed get widgetStore(): CatalogWidgetStore | undefined {
        const catalogFileId = this.catalogFileId;
        const catalogWidgetStoreId = catalogFileId !== undefined ? CatalogStore.Instance.catalogWidgets.get(catalogFileId) : undefined;
        return catalogWidgetStoreId ? WidgetsStore.Instance.catalogWidgets.get(catalogWidgetStoreId) : undefined;
    }

    @computed get catalogFileId() {
        return CatalogStore.Instance.catalogProfiles?.get(this.widgetId);
    }

    @computed get profileStore(): CatalogProfileStore | CatalogOnlineQueryProfileStore | undefined {
        const catalogFileId = this.catalogFileId;
        return catalogFileId !== undefined ? CatalogStore.Instance.catalogProfileStores.get(catalogFileId) : undefined;
    }

    @computed get axisOption() {
        const profileStore = this.profileStore;
        const axisOptions: string[] = [];
        axisOptions.push(CatalogOverlay.NONE);
        profileStore?.catalogControlHeader?.forEach((header, columnName) => {
            if (header.dataIndex !== undefined) {
                const dataType = profileStore.catalogHeader[header.dataIndex]?.dataType;
                if (isCatalogAxisDataType(dataType) && header.display) {
                    axisOptions.push(columnName);
                }
            }
        });
        return axisOptions;
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);
        this.widgetId = props.id;
        this.floatingSettingsId = props.floatingSettingsId;

        const appStore = AppStore.Instance;
        this.catalogFileNames = new Map<number, string>();

        makeObservable(this);

        this.disposers.push(
            autorun(() => {
                const catalogStore = CatalogStore.Instance;
                const catalogFileId = this.catalogFileId;
                if (catalogFileId !== undefined) {
                    const catalogWidgetStoreId = catalogStore.catalogWidgets.get(catalogFileId);
                    const activeFiles = catalogStore.activeCatalogFiles;
                    if (!catalogWidgetStoreId) {
                        WidgetsStore.Instance.addCatalogWidget(catalogFileId);
                    }

                    if (activeFiles?.includes(catalogFileId)) {
                        const fileName = catalogStore.getCatalogFileNames([catalogFileId]).get(catalogFileId);
                        if (fileName && this.floatingSettingsId) {
                            appStore.widgetsStore.setWidgetTitle(this.floatingSettingsId, `Catalog Settings: ${fileName}`);
                        }
                    } else {
                        if (this.floatingSettingsId) {
                            appStore.widgetsStore.setWidgetTitle(this.floatingSettingsId, `Catalog Settings`);
                        }
                    }
                }
            })
        );
    }

    componentWillUnmount() {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
    }

    @action handleCatalogFileChange = (fileId: number) => {
        CatalogStore.Instance.catalogProfiles?.set(this.widgetId, fileId);
    };

    public render() {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const darkTheme = AppStore.Instance.darkTheme;

        const widgetStore = this.widgetStore;
        if (!widgetStore) {
            return null;
        }

        const catalogStore = CatalogStore.Instance;
        const catalogFileIds = catalogStore.activeCatalogFiles;

        const catalogFileItems: number[] = [];
        catalogFileIds.forEach(value => {
            catalogFileItems.push(value);
        });
        this.catalogFileNames = CatalogStore.Instance.getCatalogFileNames(catalogFileIds);
        const catalogFileId = this.catalogFileId;
        const fileName = catalogFileId !== undefined ? this.catalogFileNames.get(catalogFileId) : undefined;
        let activeFileName = "";
        if (fileName !== undefined && catalogFileId !== undefined) {
            activeFileName = `${catalogFileId}: ${fileName}`;
        }
        const disabledOverlayPanel = catalogFileIds.length <= 0;
        const disableSizeMap = disabledOverlayPanel || widgetStore.disableSizeMap;
        const disableColorMap = disabledOverlayPanel || widgetStore.disableColorMap;
        const disableOrientationMap = disabledOverlayPanel || widgetStore.disableOrientationMap;
        const disableSizeMinorMap = disableSizeMap || widgetStore.disableSizeMinorMap;

        const noResults = <MenuItem disabled={true} text="No results" />;

        const sizeMajor = (
            <div className="panel-container">
                <FormGroup inline={true} label="Column" disabled={disabledOverlayPanel}>
                    <Select
                        items={this.axisOption}
                        activeItem={null}
                        onItemSelect={columnName => widgetStore.setSizeMap(columnName)}
                        itemRenderer={this.renderAxisPopOver}
                        disabled={disabledOverlayPanel}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        filterable={true}
                        noResults={noResults}
                        itemPredicate={this.filterColumn}
                        resetOnSelect={true}
                    >
                        <Button text={widgetStore.sizeMapColumn} disabled={disabledOverlayPanel} rightIcon="double-caret-vertical" data-testid="catalog-settings-major-size-column-dropdown" />
                    </Select>
                </FormGroup>
                <Collapse isOpen={!disableSizeMap}>
                    <FormGroup label={"Scaling"} inline={true} disabled={disableSizeMap}>
                        <ScalingSelectComponent selectedItem={widgetStore.sizeScalingType} onItemSelect={type => widgetStore.setSizeScalingType(type)} disabled={disableSizeMap} />
                    </FormGroup>
                    <FormGroup inline={true} label={"Size mode"} disabled={disableSizeMap}>
                        <ButtonGroup>
                            <AnchorButton disabled={disableSizeMap} text={"Diameter"} active={!widgetStore.sizeArea} onClick={() => widgetStore.setSizeArea(false)} />
                            <AnchorButton disabled={disableSizeMap} text={"Area"} active={widgetStore.sizeArea} onClick={() => widgetStore.setSizeArea(true)} />
                        </ButtonGroup>
                    </FormGroup>
                    <div className="numeric-input-lock">
                        <ClearableNumericInputComponent
                            label="Clip min"
                            max={widgetStore.sizeColumnMax.clipd}
                            integerOnly={false}
                            value={widgetStore.sizeColumnMin.clipd ?? 0}
                            onValueChanged={val => widgetStore.setSizeColumnMin(val, "clipd")}
                            onValueCleared={() => widgetStore.resetSizeColumnValue("min")}
                            displayExponential={true}
                            disabled={disableSizeMap || widgetStore.sizeMinorColumnMinLocked}
                        />
                        <AnchorButton
                            className="lock-button"
                            icon={widgetStore.sizeColumnMinLocked || widgetStore.sizeMinorColumnMinLocked ? "lock" : "unlock"}
                            intent={widgetStore.sizeColumnMinLocked ? "success" : "none"}
                            disabled={disableSizeMinorMap || widgetStore.sizeMinorColumnMinLocked}
                            minimal={true}
                            onClick={widgetStore.toggleSizeColumnMinLock}
                        />
                    </div>
                    <div className="numeric-input-lock">
                        <ClearableNumericInputComponent
                            label="Clip max"
                            min={widgetStore.sizeColumnMin.clipd}
                            integerOnly={false}
                            value={widgetStore.sizeColumnMax.clipd ?? 0}
                            onValueChanged={val => widgetStore.setSizeColumnMax(val, "clipd")}
                            onValueCleared={() => widgetStore.resetSizeColumnValue("max")}
                            displayExponential={true}
                            disabled={disableSizeMap || widgetStore.sizeMinorColumnMaxLocked}
                        />
                        <AnchorButton
                            className="lock-button"
                            icon={widgetStore.sizeColumnMaxLocked || widgetStore.sizeMinorColumnMaxLocked ? "lock" : "unlock"}
                            intent={widgetStore.sizeColumnMaxLocked ? "success" : "none"}
                            disabled={disableSizeMinorMap || widgetStore.sizeMinorColumnMaxLocked}
                            minimal={true}
                            onClick={widgetStore.toggleSizeColumnMaxLock}
                        />
                    </div>
                    <FormGroup inline={true} label="Size min" disabled={disableSizeMap}>
                        <SafeNumericInput
                            allowNumericCharactersOnly={true}
                            asyncControl={true}
                            placeholder="Min"
                            disabled={disableSizeMap}
                            buttonPosition={"none"}
                            value={widgetStore.sizeMajor ? widgetStore.pointSizebyType.min : widgetStore.minorPointSizebyType.min}
                            onBlur={ev => this.handleChange(ev, "size-min")}
                            onKeyDown={ev => this.handleChange(ev, "size-min")}
                        />
                        <Collapse className="select-angular-unit" isOpen={!widgetStore.sizeArea}>
                            <FormGroup inline={true}>
                                <Select
                                    items={Object.values(CatalogSizeUnits)}
                                    activeItem={null}
                                    onItemSelect={units => widgetStore.setCanvasSizeUnit(units)}
                                    itemRenderer={this.renderUnitPopOver}
                                    disabled={disableSizeMap}
                                    popoverProps={{minimal: true}}
                                    filterable={false}
                                    resetOnSelect={true}
                                >
                                    <Button text={widgetStore.canvasSizeUnit} disabled={disableSizeMap} rightIcon="double-caret-vertical" />
                                </Select>
                            </FormGroup>
                        </Collapse>
                    </FormGroup>
                    <FormGroup inline={true} label="Size max" disabled={disableSizeMap}>
                        <Tooltip content={`Maximum size ${widgetStore.maxPointSizebyType}`}>
                            <SafeNumericInput
                                allowNumericCharactersOnly={true}
                                asyncControl={true}
                                placeholder="Max"
                                disabled={disableSizeMap}
                                buttonPosition={"none"}
                                value={widgetStore.sizeMajor ? widgetStore.pointSizebyType.max : widgetStore.minorPointSizebyType.max}
                                onBlur={ev => this.handleChange(ev, "size-max")}
                                onKeyDown={ev => this.handleChange(ev, "size-max")}
                            />
                        </Tooltip>
                        <Collapse className="select-angular-unit" isOpen={!widgetStore.sizeArea}>
                            <FormGroup inline={true}>
                                <Select
                                    items={Object.values(CatalogSizeUnits)}
                                    activeItem={null}
                                    onItemSelect={units => widgetStore.setCanvasSizeUnit(units)}
                                    itemRenderer={this.renderUnitPopOver}
                                    disabled={disableSizeMap}
                                    popoverProps={{minimal: true}}
                                    filterable={false}
                                    resetOnSelect={true}
                                >
                                    <Button text={widgetStore.canvasSizeUnit} disabled={disableSizeMap} rightIcon="double-caret-vertical" />
                                </Select>
                            </FormGroup>
                        </Collapse>
                    </FormGroup>
                </Collapse>
            </div>
        );

        const sizeMinor = (
            <div className="panel-container">
                <FormGroup inline={true} label="Column" disabled={disabledOverlayPanel}>
                    <Select
                        items={this.axisOption}
                        activeItem={null}
                        onItemSelect={columnName => widgetStore.setSizeMinorMap(columnName)}
                        itemRenderer={this.renderAxisPopOver}
                        disabled={disabledOverlayPanel}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        filterable={true}
                        noResults={noResults}
                        itemPredicate={this.filterColumn}
                        resetOnSelect={true}
                    >
                        <Button text={widgetStore.sizeMinorMapColumn} disabled={disabledOverlayPanel} rightIcon="double-caret-vertical" />
                    </Select>
                </FormGroup>
                <Collapse isOpen={!disableSizeMinorMap}>
                    <FormGroup label={"Scaling"} inline={true} disabled={disableSizeMinorMap}>
                        <ScalingSelectComponent selectedItem={widgetStore.sizeMinorScalingType} onItemSelect={type => widgetStore.setSizeMinorScalingType(type)} disabled={disableSizeMinorMap} />
                    </FormGroup>
                    <FormGroup inline={true} label={"Size mode"} disabled={disableSizeMinorMap}>
                        <ButtonGroup>
                            <AnchorButton disabled={disableSizeMinorMap} text={"Diameter"} active={!widgetStore.sizeMinorArea} onClick={() => widgetStore.setSizeMinorArea(false)} />
                            <AnchorButton disabled={disableSizeMinorMap} text={"Area"} active={widgetStore.sizeMinorArea} onClick={() => widgetStore.setSizeMinorArea(true)} />
                        </ButtonGroup>
                    </FormGroup>
                    <div className="numeric-input-lock">
                        <ClearableNumericInputComponent
                            label="Clip min"
                            max={widgetStore.sizeMinorColumnMax.clipd}
                            integerOnly={false}
                            value={widgetStore.sizeMinorColumnMin.clipd ?? 0}
                            onValueChanged={val => widgetStore.setSizeMinorColumnMin(val, "clipd")}
                            onValueCleared={() => widgetStore.resetSizeMinorColumnValue("min")}
                            displayExponential={true}
                            disabled={disableSizeMinorMap || widgetStore.sizeColumnMinLocked}
                        />
                        <AnchorButton
                            className="lock-button"
                            icon={widgetStore.sizeColumnMinLocked || widgetStore.sizeMinorColumnMinLocked ? "lock" : "unlock"}
                            intent={widgetStore.sizeMinorColumnMinLocked ? "success" : "none"}
                            disabled={disableSizeMinorMap || widgetStore.sizeColumnMinLocked}
                            minimal={true}
                            onClick={widgetStore.toggleSizeMinorColumnMinLock}
                        />
                    </div>
                    <div className="numeric-input-lock">
                        <ClearableNumericInputComponent
                            label="Clip max"
                            min={widgetStore.sizeMinorColumnMin.clipd}
                            integerOnly={false}
                            value={widgetStore.sizeMinorColumnMax.clipd ?? 0}
                            onValueChanged={val => widgetStore.setSizeMinorColumnMax(val, "clipd")}
                            onValueCleared={() => widgetStore.resetSizeMinorColumnValue("max")}
                            displayExponential={true}
                            disabled={disableSizeMinorMap || widgetStore.sizeColumnMaxLocked}
                        />
                        <AnchorButton
                            className="lock-button"
                            icon={widgetStore.sizeColumnMaxLocked || widgetStore.sizeMinorColumnMaxLocked ? "lock" : "unlock"}
                            intent={widgetStore.sizeMinorColumnMaxLocked ? "success" : "none"}
                            disabled={disableSizeMinorMap || widgetStore.sizeColumnMaxLocked}
                            minimal={true}
                            onClick={widgetStore.toggleSizeMinorColumnMaxLock}
                        />
                    </div>
                    <FormGroup inline={true} label="Size min" disabled={disableSizeMap}>
                        <SafeNumericInput
                            allowNumericCharactersOnly={true}
                            asyncControl={true}
                            placeholder="Min"
                            disabled={disableSizeMap}
                            buttonPosition={"none"}
                            value={widgetStore.sizeMajor ? widgetStore.pointSizebyType.min : widgetStore.minorPointSizebyType.min}
                            onBlur={ev => this.handleChange(ev, "size-min")}
                            onKeyDown={ev => this.handleChange(ev, "size-min")}
                        />
                        <Collapse className="select-angular-unit" isOpen={!widgetStore.sizeArea}>
                            <FormGroup inline={true}>
                                <Select
                                    items={Object.values(CatalogSizeUnits)}
                                    activeItem={null}
                                    onItemSelect={units => widgetStore.setCanvasSizeUnit(units)}
                                    itemRenderer={this.renderUnitPopOver}
                                    disabled={disableSizeMap}
                                    popoverProps={{minimal: true}}
                                    filterable={false}
                                    resetOnSelect={true}
                                >
                                    <Button text={widgetStore.canvasSizeUnit} disabled={disableSizeMap} rightIcon="double-caret-vertical" />
                                </Select>
                            </FormGroup>
                        </Collapse>
                    </FormGroup>
                    <FormGroup inline={true} label="Size max" disabled={disableSizeMap}>
                        <Tooltip content={`Maximum size ${widgetStore.maxPointSizebyType}`}>
                            <SafeNumericInput
                                allowNumericCharactersOnly={true}
                                asyncControl={true}
                                placeholder="Max"
                                disabled={disableSizeMap}
                                buttonPosition={"none"}
                                value={widgetStore.sizeMajor ? widgetStore.pointSizebyType.max : widgetStore.minorPointSizebyType.max}
                                onBlur={ev => this.handleChange(ev, "size-max")}
                                onKeyDown={ev => this.handleChange(ev, "size-max")}
                            />
                        </Tooltip>
                        <Collapse className="select-angular-unit" isOpen={!widgetStore.sizeArea}>
                            <FormGroup inline={true}>
                                <Select
                                    items={Object.values(CatalogSizeUnits)}
                                    activeItem={null}
                                    onItemSelect={units => widgetStore.setCanvasSizeUnit(units)}
                                    itemRenderer={this.renderUnitPopOver}
                                    disabled={disableSizeMap}
                                    popoverProps={{minimal: true}}
                                    filterable={false}
                                    resetOnSelect={true}
                                >
                                    <Button text={widgetStore.canvasSizeUnit} disabled={disableSizeMap} rightIcon="double-caret-vertical" />
                                </Select>
                            </FormGroup>
                        </Collapse>
                    </FormGroup>
                </Collapse>
            </div>
        );

        const sizeMap = (
            <div className="panel-container">
                <FormGroup inline={true} label="Size" disabled={disabledOverlayPanel}>
                    <Tooltip disabled={disabledOverlayPanel || !widgetStore.disableSizeMap} content={`${widgetStore.minOverlaySize} ~ ${widgetStore.maxOverlaySize}`}>
                        <SafeNumericInput
                            placeholder="Size"
                            disabled={disabledOverlayPanel || !widgetStore.disableSizeMap}
                            min={widgetStore.minOverlaySize}
                            max={widgetStore.maxOverlaySize}
                            clampValueOnBlur={true}
                            value={widgetStore.showedCatalogSize}
                            stepSize={0.5}
                            minorStepSize={0.0001}
                            onValueChange={(value: number) => widgetStore.setCatalogSize(value)}
                            data-testid="catalog-settings-size-input"
                        />
                    </Tooltip>
                    <Collapse className="select-angular-unit" isOpen={widgetStore.disableSizeMap}>
                        <FormGroup inline={true}>
                            <Select
                                items={Object.values(CatalogSizeUnits)}
                                activeItem={null}
                                onItemSelect={units => widgetStore.setCanvasSizeUnit(units)}
                                itemRenderer={this.renderUnitPopOver}
                                disabled={disabledOverlayPanel}
                                popoverProps={{minimal: true}}
                                filterable={false}
                                resetOnSelect={true}
                            >
                                <Button text={widgetStore.canvasSizeUnit} disabled={disabledOverlayPanel || !widgetStore.disableSizeMap} rightIcon="double-caret-vertical" />
                            </Select>
                        </FormGroup>
                    </Collapse>
                </FormGroup>
                <FormGroup inline={true} label="Thickness" disabled={disabledOverlayPanel}>
                    <Tooltip disabled={disabledOverlayPanel} content={`${CatalogWidgetStore.MinThickness} ~ ${CatalogWidgetStore.MaxThickness}`}>
                        <SafeNumericInput
                            placeholder="Thickness"
                            disabled={disabledOverlayPanel}
                            min={CatalogWidgetStore.MinThickness}
                            max={CatalogWidgetStore.MaxThickness}
                            clampValueOnBlur={true}
                            value={widgetStore.thickness}
                            stepSize={0.5}
                            onValueChange={(value: number) => widgetStore.setThickness(value)}
                            data-testid="catalog-settings-thickness-input"
                        />
                    </Tooltip>
                </FormGroup>
                <Tabs id="catalogSettings" vertical={false} selectedTabId={widgetStore.sizeAxisTabId} onChange={tabId => this.handleSelectedAxisTabChanged(tabId)}>
                    <Tab id={CatalogSettingsTabs.SIZE_MAJOR} title="Major" panel={sizeMajor} />
                    <Tab id={CatalogSettingsTabs.SIZE_MINOR} title="Minor" panel={sizeMinor} disabled={!widgetStore.enableSizeMinorTab} />
                </Tabs>
            </div>
        );

        const angularSizePanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Major" disabled={disabledOverlayPanel}>
                    <Select
                        items={this.axisOption}
                        activeItem={null}
                        onItemSelect={columnName => widgetStore.setSizeMap(columnName)}
                        itemRenderer={this.renderAxisPopOver}
                        disabled={disabledOverlayPanel}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        filterable={true}
                        noResults={noResults}
                        itemPredicate={this.filterColumn}
                        resetOnSelect={true}
                    >
                        <Button text={widgetStore.sizeMapColumn} disabled={disabledOverlayPanel} rightIcon="double-caret-vertical" data-testid="catalog-settings-major-size-column-dropdown" />
                    </Select>
                </FormGroup>
                <FormGroup inline={true} label="Minor" disabled={!widgetStore.enableSizeMinorTab}>
                    <Select
                        items={this.axisOption}
                        activeItem={null}
                        onItemSelect={columnName => widgetStore.setSizeMinorMap(columnName)}
                        itemRenderer={this.renderAxisPopOver}
                        disabled={!widgetStore.enableSizeMinorTab}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        filterable={true}
                        noResults={noResults}
                        itemPredicate={this.filterColumn}
                        resetOnSelect={true}
                    >
                        <Button text={widgetStore.sizeMinorMapColumn} disabled={!widgetStore.enableSizeMinorTab} rightIcon="double-caret-vertical" />
                    </Select>
                </FormGroup>
                <FormGroup inline={true} label="Unit">
                    <Select
                        items={Object.values(AngularSizeUnit).filter(item => item !== AngularSizeUnit.MILLIARCSEC)}
                        activeItem={null}
                        onItemSelect={units => widgetStore.setWorldSizeUnit(units)}
                        itemRenderer={this.renderAngularUnitPopOver}
                        disabled={!widgetStore.isAngularSize}
                        popoverProps={{minimal: true}}
                        filterable={false}
                        resetOnSelect={true}
                    >
                        <Button text={widgetStore.worldSizeUnit} disabled={!widgetStore.isAngularSize} rightIcon="double-caret-vertical" />
                    </Select>
                </FormGroup>
                <FormGroup inline={true} label="Thickness" disabled={disabledOverlayPanel}>
                    <Tooltip disabled={disabledOverlayPanel} content={`${CatalogWidgetStore.MinThickness} ~ ${CatalogWidgetStore.MaxThickness}`}>
                        <SafeNumericInput
                            placeholder="Thickness"
                            disabled={disabledOverlayPanel}
                            min={CatalogWidgetStore.MinThickness}
                            max={CatalogWidgetStore.MaxThickness}
                            clampValueOnBlur={true}
                            value={widgetStore.thickness}
                            stepSize={0.5}
                            onValueChange={(value: number) => widgetStore.setThickness(value)}
                            data-testid="catalog-settings-thickness-input"
                        />
                    </Tooltip>
                </FormGroup>
            </div>
        );

        const colorMap = (
            <div className="panel-container" data-testid="catalog-settings-color-tab">
                <FormGroup label={"Color"} inline={true} disabled={disabledOverlayPanel || !widgetStore.disableColorMap}>
                    <AutoColorPickerComponent
                        color={widgetStore.catalogColor}
                        presetColors={[...SWATCH_COLORS, "transparent"]}
                        setColor={(color: string) => {
                            widgetStore.setCatalogColor(color === "transparent" ? "#000000" : getColorForTheme(color));
                        }}
                        disableAlpha={true}
                        disabled={disabledOverlayPanel || !widgetStore.disableColorMap}
                    />
                </FormGroup>
                <FormGroup label={"Overlay highlight"} inline={true} disabled={disabledOverlayPanel}>
                    <AutoColorPickerComponent
                        color={widgetStore.highlightColor}
                        presetColors={[...SWATCH_COLORS, "transparent"]}
                        setColor={(color: string) => {
                            widgetStore.setHighlightColor(color === "transparent" ? "#000000" : getColorForTheme(color));
                        }}
                        disableAlpha={true}
                        disabled={disabledOverlayPanel}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Column" disabled={disabledOverlayPanel}>
                    <Select
                        items={this.axisOption}
                        activeItem={null}
                        onItemSelect={columnName => widgetStore.setColorMapColumn(columnName)}
                        itemRenderer={this.renderAxisPopOver}
                        disabled={disabledOverlayPanel}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        filterable={true}
                        noResults={noResults}
                        itemPredicate={this.filterColumn}
                        resetOnSelect={true}
                    >
                        <Button text={widgetStore.colorMapColumn} disabled={disabledOverlayPanel} rightIcon="double-caret-vertical" data-testid="catalog-settings-color-column-dropdown" />
                    </Select>
                </FormGroup>
                <Collapse isOpen={!disableColorMap}>
                    <FormGroup label={"Scaling"} inline={true} disabled={disableColorMap}>
                        <ScalingSelectComponent selectedItem={widgetStore.colorScalingType} onItemSelect={type => widgetStore.setColorScalingType(type)} disabled={disableColorMap} />
                    </FormGroup>
                    <FormGroup inline={true} label="Colormap" disabled={disableColorMap}>
                        <ColormapComponent inverted={false} selectedColormap={widgetStore.colorMap} onColormapSelect={selected => widgetStore.setColorMap(selected)} disabled={disableColorMap} />
                    </FormGroup>
                    <FormGroup label={"Invert colormap"} inline={true} disabled={disableColorMap}>
                        <Switch checked={widgetStore.invertedColorMap} onChange={ev => widgetStore.setColorMapDirection(ev.currentTarget.checked)} disabled={disableColorMap} />
                    </FormGroup>
                    <ClearableNumericInputComponent
                        label="Clip min"
                        max={widgetStore.colorColumnMax.clipd}
                        integerOnly={false}
                        value={widgetStore.colorColumnMin.clipd ?? 0}
                        onValueChanged={val => widgetStore.setColorColumnMin(val, "clipd")}
                        onValueCleared={() => widgetStore.resetColorColumnValue("min")}
                        displayExponential={true}
                        disabled={disableColorMap}
                    />
                    <ClearableNumericInputComponent
                        label="Clip max"
                        min={widgetStore.colorColumnMin.clipd}
                        integerOnly={false}
                        value={widgetStore.colorColumnMax.clipd ?? 0}
                        onValueChanged={val => widgetStore.setColorColumnMax(val, "clipd")}
                        onValueCleared={() => widgetStore.resetColorColumnValue("max")}
                        displayExponential={true}
                        disabled={disableColorMap}
                    />
                </Collapse>
            </div>
        );

        const orientationMap = (
            <div className="panel-container">
                <FormGroup
                    inline={true}
                    label={widgetStore.catalogDisplayMode === CatalogDisplayMode.WORLD ? "P.A." : "Column"}
                    labelInfo={widgetStore.catalogDisplayMode === CatalogDisplayMode.WORLD ? "(deg)" : ""}
                    disabled={disabledOverlayPanel}
                >
                    <Select
                        items={this.axisOption}
                        activeItem={null}
                        onItemSelect={columnName => widgetStore.setOrientationMapColumn(columnName)}
                        itemRenderer={this.renderAxisPopOver}
                        disabled={disabledOverlayPanel}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        filterable={true}
                        noResults={noResults}
                        itemPredicate={this.filterColumn}
                        resetOnSelect={true}
                    >
                        <Button text={widgetStore.orientationMapColumn} disabled={disabledOverlayPanel} rightIcon="double-caret-vertical" data-testid="catalog-settings-orientation-column-dropdown" />
                    </Select>
                </FormGroup>
                <Collapse isOpen={!disableOrientationMap && widgetStore.catalogDisplayMode !== CatalogDisplayMode.WORLD}>
                    <FormGroup label={"Scaling"} inline={true} disabled={disableOrientationMap}>
                        <ScalingSelectComponent selectedItem={widgetStore.orientationScalingType} onItemSelect={type => widgetStore.setOrientationScalingType(type)} disabled={disableOrientationMap} />
                    </FormGroup>
                    <FormGroup inline={true} label="Orientation" labelInfo="(degree)" disabled={disableOrientationMap}>
                        <div className="parameter-container">
                            <FormGroup inline={true} label="Min">
                                <SafeNumericInput
                                    allowNumericCharactersOnly={true}
                                    asyncControl={true}
                                    placeholder="Min"
                                    disabled={disableOrientationMap}
                                    buttonPosition={"none"}
                                    value={widgetStore.angleMin}
                                    onBlur={ev => this.handleChange(ev, "angle-min")}
                                    onKeyDown={ev => this.handleChange(ev, "angle-min")}
                                />
                            </FormGroup>
                            <FormGroup inline={true} label="Max">
                                <SafeNumericInput
                                    allowNumericCharactersOnly={true}
                                    asyncControl={true}
                                    placeholder="Max"
                                    disabled={disableOrientationMap}
                                    buttonPosition={"none"}
                                    value={widgetStore.angleMax}
                                    onBlur={ev => this.handleChange(ev, "angle-max")}
                                    onKeyDown={ev => this.handleChange(ev, "angle-max")}
                                />
                            </FormGroup>
                        </div>
                    </FormGroup>
                    <ClearableNumericInputComponent
                        label="Clip min"
                        max={widgetStore.orientationMax.clipd}
                        integerOnly={false}
                        value={widgetStore.orientationMin.clipd ?? 0}
                        onValueChanged={val => widgetStore.setOrientationMin(val, "clipd")}
                        onValueCleared={() => widgetStore.resetOrientationValue("min")}
                        displayExponential={true}
                        disabled={disableOrientationMap}
                    />
                    <ClearableNumericInputComponent
                        label="Clip max"
                        min={widgetStore.orientationMin.clipd}
                        integerOnly={false}
                        value={widgetStore.orientationMax.clipd ?? 0}
                        onValueChanged={val => widgetStore.setOrientationMax(val, "clipd")}
                        onValueCleared={() => widgetStore.resetOrientationValue("max")}
                        displayExponential={true}
                        disabled={disableOrientationMap}
                    />
                </Collapse>
            </div>
        );

        return (
            <ScrollShadow>
                <div className={"catalog-settings"}>
                    <FormGroup className={"file-menu"} inline={true} label="File" disabled={disabledOverlayPanel}>
                        <Select
                            className={Classes.FILL}
                            disabled={disabledOverlayPanel}
                            filterable={false}
                            items={catalogFileItems}
                            activeItem={this.catalogFileId}
                            onItemSelect={this.handleCatalogFileChange}
                            itemRenderer={this.renderFileIdPopOver}
                            popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                            fill={true}
                        >
                            <Button text={activeFileName} rightIcon="double-caret-vertical" disabled={disabledOverlayPanel} />
                        </Select>
                    </FormGroup>
                    <FormGroup className={"file-menu"} inline={true} label="Shape" disabled={disabledOverlayPanel}>
                        <Select
                            className={Classes.FILL}
                            disabled={disabledOverlayPanel}
                            filterable={false}
                            items={
                                widgetStore.catalogDisplayMode === CatalogDisplayMode.WORLD ? this.catalogOverlayShape.filter(f => f === CatalogOverlayShape.ELLIPSE_LINED || f === CatalogOverlayShape.CIRCLE_LINED) : this.catalogOverlayShape
                            }
                            activeItem={widgetStore.catalogShape}
                            onItemSelect={item => widgetStore.setCatalogShape(item)}
                            itemRenderer={this.renderShapePopOver}
                            popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        >
                            <Button icon={this.getCatalogShape(widgetStore.catalogShape)} rightIcon="double-caret-vertical" disabled={disabledOverlayPanel} data-testid="catalog-settings-shape-dropdown" />
                        </Select>
                    </FormGroup>
                    <FormGroup className={"file-menu"} inline={true} label="Mode" disabled={disabledOverlayPanel}>
                        <ButtonGroup>
                            <AnchorButton
                                onClick={() => widgetStore.setCatalogDisplayMode(CatalogDisplayMode.CANVAS)}
                                text={CatalogDisplayMode.CANVAS}
                                active={widgetStore.catalogDisplayMode === CatalogDisplayMode.CANVAS}
                                disabled={disabledOverlayPanel}
                            />
                            <AnchorButton
                                onClick={() => widgetStore.setCatalogDisplayMode(CatalogDisplayMode.WORLD)}
                                text={CatalogDisplayMode.WORLD}
                                active={widgetStore.catalogDisplayMode === CatalogDisplayMode.WORLD}
                                disabled={disabledOverlayPanel}
                            />
                        </ButtonGroup>
                    </FormGroup>
                    <Tabs id="catalogSettings" vertical={false} selectedTabId={widgetStore.settingsTabId} onChange={tabId => this.handleSelectedTabChanged(tabId)}>
                        <Tab id={CatalogSettingsTabs.SIZE} title="Size" panel={widgetStore.catalogDisplayMode === CatalogDisplayMode.WORLD ? angularSizePanel : sizeMap} disabled={disabledOverlayPanel} />
                        <Tab id={CatalogSettingsTabs.COLOR} title="Color" panel={colorMap} disabled={disabledOverlayPanel} data-testid="catalog-settings-color-tab-title" />
                        <Tab id={CatalogSettingsTabs.ORIENTATION} title="Orientation" panel={orientationMap} disabled={disabledOverlayPanel} data-testid="catalog-settings-orientation-tab-title" />
                    </Tabs>
                </div>
            </ScrollShadow>
        );
    }

    private renderAxisPopOver = (catalogName: string, itemProps: ItemRendererProps) => {
        return <MenuItem key={catalogName} text={catalogName} onClick={itemProps.handleClick} />;
    };

    private renderUnitPopOver = (unit: CatalogSizeUnits, itemProps: ItemRendererProps) => {
        return <MenuItem key={unit} text={unit} onClick={itemProps.handleClick} />;
    };

    private renderAngularUnitPopOver = (unit: AngularSizeUnit, itemProps: ItemRendererProps) => {
        return <MenuItem key={unit} text={unit} onClick={itemProps.handleClick} />;
    };

    private filterColumn: ItemPredicate<string> = (query: string, columnName: string) => {
        const fileSearcher = new FuzzySearch([columnName]);
        return fileSearcher.search(query).length > 0;
    };

    private handleChange = (ev, type: ValueClip) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        if (!widgetStore) {
            return;
        }
        const pointSize = widgetStore.sizeMajor ? widgetStore.pointSizebyType : widgetStore.minorPointSizebyType;

        switch (type) {
            case "size-min":
                if (isFinite(val) && val !== pointSize.min && val < pointSize.max && val >= CatalogWidgetStore.SizeMapMin) {
                    const inputVal = val;
                    if (widgetStore.sizeAxisTabId === CatalogSettingsTabs.SIZE_MINOR) {
                        widgetStore.setMinorSizeMin(inputVal);
                    } else {
                        widgetStore.setSizeMin(inputVal);
                    }
                } else {
                    ev.currentTarget.value = pointSize.min.toString();
                }
                break;
            case "size-max":
                if (isFinite(val) && val !== pointSize.max && val > pointSize.min && val <= widgetStore.maxPointSizebyType) {
                    const inputVal = val;
                    if (widgetStore.sizeAxisTabId === CatalogSettingsTabs.SIZE_MINOR) {
                        widgetStore.setMinorSizeMax(inputVal);
                    } else {
                        widgetStore.setSizeMax(inputVal);
                    }
                } else {
                    ev.currentTarget.value = pointSize.max.toString();
                }
                break;
            case "angle-min":
                if (isFinite(val) && val < widgetStore.angleMax) {
                    widgetStore.setAngleMin(val);
                } else {
                    ev.currentTarget.value = widgetStore.angleMin.toString();
                }
                break;
            case "angle-max":
                if (isFinite(val) && val > widgetStore.angleMin) {
                    widgetStore.setAngleMax(val);
                } else {
                    ev.currentTarget.value = widgetStore.angleMax.toString();
                }
                break;
            default:
                break;
        }
    };

    private renderFileIdPopOver = (fileId: number, itemProps: ItemRendererProps) => {
        const fileName = this.catalogFileNames.get(fileId);
        const text = `${fileId}: ${fileName}`;
        return <MenuItem key={fileId} text={text} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
    };

    private renderShapePopOver = (shape: CatalogOverlayShape, itemProps: ItemRendererProps) => {
        const shapeItem = this.getCatalogShape(shape);
        return <MenuItem icon={shapeItem} key={shape} text={""} onClick={itemProps.handleClick} active={itemProps.modifiers.active} data-testid={"catalog-settings-shape-" + CatalogOverlayShape[shape].toLowerCase().replaceAll("_", "-")} />;
    };

    private handleSelectedTabChanged = (newTabId: React.ReactText) => {
        this.widgetStore?.setSettingsTabId(Number.parseInt(newTabId.toString()));
    };

    private handleSelectedAxisTabChanged = (newTabId: React.ReactText) => {
        this.widgetStore?.setSizeAxisTab(Number.parseInt(newTabId.toString()));
    };

    private getCatalogShape = (shape: CatalogOverlayShape) => {
        const widgetStore = this.widgetStore;
        const color = widgetStore?.catalogColor ?? Colors.TURQUOISE3;
        switch (shape) {
            case CatalogOverlayShape.CIRCLE_LINED:
                return <Icon icon="circle" color={color} />;
            case CatalogOverlayShape.CIRCLE_FILLED:
                return <Icon icon="full-circle" color={color} />;
            case CatalogOverlayShape.BOX_LINED:
                return <Icon icon="square" color={color} />;
            case CatalogOverlayShape.CROSS_FILLED:
                return <Icon icon="plus" color={color} />;
            case CatalogOverlayShape.X_FILLED:
                return <Icon icon="cross" color={color} />;
            case CatalogOverlayShape.TRIANGLE_LINED_UP:
                return IconWrapper(TRIANGLE_UP, color, false);
            case CatalogOverlayShape.TRIANGLE_LINED_DOWN:
                return IconWrapper(TRIANGLE_DOWN, color, false);
            case CatalogOverlayShape.RHOMB_LINED:
                return IconWrapper(RHOMB, color, false);
            case CatalogOverlayShape.HEXAGON_LINED_2:
                return IconWrapper(HEXAGON2, color, false);
            case CatalogOverlayShape.HEXAGON_LINED:
                return IconWrapper(HEXAGON, color, false);
            case CatalogOverlayShape.ELLIPSE_LINED:
                return IconWrapper(ELLIPSE, color, false);
            case CatalogOverlayShape.LineSegment_FILLED:
                return <Icon icon="minus" style={{transform: "rotate(90deg)"}} color={color} />;
            default:
                return <Icon icon="circle" color={color} />;
        }
    };
}
