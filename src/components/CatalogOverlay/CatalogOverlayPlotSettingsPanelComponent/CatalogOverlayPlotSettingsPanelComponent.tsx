import * as React from "react";
import {AnchorButton, Button, ButtonGroup, Classes, Collapse, Colors, FormGroup, Icon, MenuItem, PopoverPosition, Switch, Tab, Tabs, Tooltip} from "@blueprintjs/core";
import {type ItemPredicate, type ItemRendererProps, Select} from "@blueprintjs/select";
import FuzzySearch from "fuzzy-search";
import {action, autorun, computed, type IReactionDisposer, makeObservable} from "mobx";
import {observer} from "mobx-react";

import {AutoColorPickerComponent, ClearableNumericInputComponent, ColormapComponent, SafeNumericInput, ScalingParameterControlComponent, ScalingSelectComponent, ScrollShadow} from "components/Shared";
import {AngularSizeUnit, CatalogDisplayMode, CatalogOverlay, CatalogOverlayShape, CatalogSettingsTabs, CatalogSizeUnits, FrameScaling, HelpType, ValueClip} from "enums";
import {AppStore, CatalogDisplayStore, type CatalogOnlineQueryProfileStore, type CatalogProfileStore, CatalogStore, type DefaultWidgetConfig, type WidgetProps, WidgetsStore} from "stores";
import {type CatalogWidgetStore} from "stores/Widgets";
import {getColorForTheme, getScalingParameterConfig, isCatalogAxisDataType, SWATCH_COLORS} from "utilities";

import "./CatalogOverlayPlotSettingsPanelComponent.scss";

const IconWrapper = (path: React.ReactNode, color: string, shouldFill: boolean, strokeWidth = 2, viewboxDefault = 16) => {
    let fillColor = color;
    if (!shouldFill) {
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

type CatalogScalingKey = "sizeScalingType" | "sizeMinorScalingType" | "colorScalingType" | "orientationScalingType";

interface CatalogScalingPreviewSession {
    displayStore: CatalogDisplayStore;
    baseScaling: FrameScaling;
}

interface CatalogColormapPreviewSession {
    displayStore: CatalogDisplayStore;
    baseColormap: string;
}

@observer
export class CatalogOverlayPlotSettingsPanelComponent extends React.Component<WidgetProps> {
    private catalogFileNames: Map<number, string>;
    private widgetId: string;
    private floatingSettingsId: string | undefined;
    private readonly disposers: IReactionDisposer[] = [];
    private readonly scalingPreviewSessions = new Map<CatalogScalingKey, CatalogScalingPreviewSession>();
    private colormapPreviewSession: CatalogColormapPreviewSession | null = null;
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

    public static get WidgetConfig(): DefaultWidgetConfig {
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

    @computed get displayStore(): CatalogDisplayStore | undefined {
        const catalogFileId = this.catalogFileId;
        return catalogFileId !== undefined ? CatalogStore.Instance.getCatalogDisplayStore(catalogFileId) : undefined;
    }

    @computed get catalogFileId() {
        return this.widgetStore?.selectedCatalogId;
    }

    @computed get widgetStore(): CatalogWidgetStore | undefined {
        return WidgetsStore.Instance.catalogWidgets.get(this.widgetId);
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
                    const activeFiles = catalogStore.activeCatalogFiles;
                    WidgetsStore.Instance.getCatalogWidgetStore(this.widgetId, catalogFileId);
                    catalogStore.getOrCreateCatalogDisplayStore(catalogFileId);

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

    componentDidUpdate() {
        const displayStore = this.displayStore;
        for (const [key, session] of this.scalingPreviewSessions) {
            if (session.displayStore !== displayStore) {
                this.revertScalingPreview(key);
            }
        }
        if (this.colormapPreviewSession && this.colormapPreviewSession.displayStore !== displayStore) {
            this.revertColormapPreview();
        }
    }

    componentWillUnmount() {
        this.revertAllPreviews();
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
    }

    private setScaling(displayStore: CatalogDisplayStore, key: CatalogScalingKey, scaling: FrameScaling) {
        switch (key) {
            case "sizeScalingType":
                displayStore.setSizeScalingType(scaling);
                break;
            case "sizeMinorScalingType":
                displayStore.setSizeMinorScalingType(scaling);
                break;
            case "colorScalingType":
                displayStore.setColorScalingType(scaling);
                break;
            case "orientationScalingType":
                displayStore.setOrientationScalingType(scaling);
                break;
        }
    }

    private revertScalingPreview(key: CatalogScalingKey) {
        const session = this.scalingPreviewSessions.get(key);
        this.scalingPreviewSessions.delete(key);
        if (session && session.displayStore[key] !== session.baseScaling) {
            this.setScaling(session.displayStore, key, session.baseScaling);
        }
    }

    private handleScalingHovered(displayStore: CatalogDisplayStore, key: CatalogScalingKey, scaling: FrameScaling) {
        const session = this.scalingPreviewSessions.get(key);
        if (session?.displayStore !== displayStore) {
            this.revertScalingPreview(key);
            this.scalingPreviewSessions.set(key, {displayStore, baseScaling: displayStore[key]});
        }
        if (displayStore[key] !== scaling) {
            this.setScaling(displayStore, key, scaling);
        }
    }

    private handleScalingSelected(displayStore: CatalogDisplayStore, key: CatalogScalingKey, scaling: FrameScaling) {
        const session = this.scalingPreviewSessions.get(key);
        if (session && session.displayStore !== displayStore) {
            this.revertScalingPreview(key);
        } else {
            this.scalingPreviewSessions.delete(key);
        }
        this.setScaling(displayStore, key, scaling);
    }

    private handleScalingDropdownOpenChange(key: CatalogScalingKey, isOpen: boolean) {
        if (!isOpen) {
            this.revertScalingPreview(key);
        }
    }

    private revertColormapPreview() {
        const session = this.colormapPreviewSession;
        this.colormapPreviewSession = null;
        if (session && session.displayStore.colorMap !== session.baseColormap) {
            session.displayStore.setColorMap(session.baseColormap);
        }
    }

    private handleColormapHovered(displayStore: CatalogDisplayStore, colormap: string) {
        if (this.colormapPreviewSession?.displayStore !== displayStore) {
            this.revertColormapPreview();
            this.colormapPreviewSession = {displayStore, baseColormap: displayStore.colorMap};
        }
        if (displayStore.colorMap !== colormap) {
            displayStore.setColorMap(colormap);
        }
    }

    private handleColormapSelected(displayStore: CatalogDisplayStore, colormap: string) {
        if (this.colormapPreviewSession && this.colormapPreviewSession.displayStore !== displayStore) {
            this.revertColormapPreview();
        } else {
            this.colormapPreviewSession = null;
        }
        displayStore.setColorMap(colormap);
    }

    private handleColormapDropdownOpenChange(isOpen: boolean) {
        if (!isOpen) {
            this.revertColormapPreview();
        }
    }

    private revertAllPreviews() {
        for (const key of Array.from(this.scalingPreviewSessions.keys())) {
            this.revertScalingPreview(key);
        }
        this.revertColormapPreview();
    }

    @action handleCatalogFileChange = (fileId: number) => {
        WidgetsStore.Instance.setCatalogPanelSelection(this.widgetId, fileId);
    };

    private renderScalingParameter(scaling: FrameScaling, value: number, onValueChange: (value: number) => void, isDisabled: boolean): React.ReactNode {
        const currentParameterConfig = getScalingParameterConfig(scaling);
        const isParameterDisabled = isDisabled || !currentParameterConfig;
        const parameterScaling = currentParameterConfig ? scaling : FrameScaling.GAMMA;
        const parameterConfig = currentParameterConfig ?? getScalingParameterConfig(FrameScaling.GAMMA)!;

        return (
            <FormGroup label={parameterScaling === FrameScaling.GAMMA ? "Gamma" : "Alpha"} inline={true} disabled={isParameterDisabled}>
                <ScalingParameterControlComponent
                    scaling={parameterScaling}
                    min={parameterConfig.min}
                    max={parameterConfig.max}
                    value={currentParameterConfig ? value : undefined}
                    disabled={isParameterDisabled}
                    onValueChange={onValueChange}
                />
            </FormGroup>
        );
    }

    public render() {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const isDarkTheme = AppStore.Instance.isDarkTheme;

        const displayStore = this.displayStore;
        if (!displayStore) {
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
        const isOverlayPanelDisabled = catalogFileIds.length <= 0;
        const shouldDisableSizeMap = isOverlayPanelDisabled || displayStore.isSizeMapDisabled;
        const shouldDisableColorMap = isOverlayPanelDisabled || displayStore.isColorMapDisabled;
        const shouldDisableOrientationMap = isOverlayPanelDisabled || displayStore.isOrientationMapDisabled;
        const shouldDisableSizeMinorMap = shouldDisableSizeMap || displayStore.isSizeMinorMapDisabled;

        const noResults = <MenuItem disabled={true} text="No results" />;

        const sizeMajor = (
            <div className="panel-container">
                <FormGroup inline={true} label="Column" disabled={isOverlayPanelDisabled}>
                    <Select
                        items={this.axisOption}
                        activeItem={null}
                        onItemSelect={columnName => displayStore.setSizeMap(columnName)}
                        itemRenderer={this.renderAxisPopOver}
                        disabled={isOverlayPanelDisabled}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        filterable={true}
                        noResults={noResults}
                        itemPredicate={this.filterColumn}
                        resetOnSelect={true}
                    >
                        <Button text={displayStore.sizeMapColumn} disabled={isOverlayPanelDisabled} endIcon="double-caret-vertical" data-testid="catalog-settings-major-size-column-dropdown" />
                    </Select>
                </FormGroup>
                <Collapse isOpen={!shouldDisableSizeMap}>
                    <FormGroup label={"Scaling"} inline={true} disabled={shouldDisableSizeMap}>
                        <ScalingSelectComponent
                            selectedItem={displayStore.sizeScalingType}
                            onItemSelect={type => this.handleScalingSelected(displayStore, "sizeScalingType", type)}
                            onItemHover={type => this.handleScalingHovered(displayStore, "sizeScalingType", type)}
                            onDropdownOpenChange={isOpen => this.handleScalingDropdownOpenChange("sizeScalingType", isOpen)}
                            disabled={shouldDisableSizeMap}
                        />
                    </FormGroup>
                    {this.renderScalingParameter(displayStore.sizeScalingType, displayStore.sizeScalingParameter, value => displayStore.setSizeScalingParameter(value), shouldDisableSizeMap)}
                    <FormGroup inline={true} label={"Size mode"} disabled={shouldDisableSizeMap}>
                        <ButtonGroup>
                            <AnchorButton disabled={shouldDisableSizeMap} text={"Diameter"} active={!displayStore.isSizeAreaMode} onClick={() => displayStore.setSizeArea(false)} />
                            <AnchorButton disabled={shouldDisableSizeMap} text={"Area"} active={displayStore.isSizeAreaMode} onClick={() => displayStore.setSizeArea(true)} />
                        </ButtonGroup>
                    </FormGroup>
                    <div className="numeric-input-lock">
                        <ClearableNumericInputComponent
                            label="Clip min"
                            max={displayStore.sizeColumnMax.clipd}
                            integerOnly={false}
                            value={displayStore.sizeColumnMin.clipd ?? 0}
                            onValueChanged={val => displayStore.setSizeColumnMin(val, "clipd")}
                            onValueCleared={() => displayStore.resetSizeColumnValue("min")}
                            displayExponential={true}
                            disabled={shouldDisableSizeMap || displayStore.isSizeMinorColumnMinLocked}
                        />
                        <AnchorButton
                            className="lock-button"
                            icon={displayStore.isSizeColumnMinLocked || displayStore.isSizeMinorColumnMinLocked ? "lock" : "unlock"}
                            intent={displayStore.isSizeColumnMinLocked ? "success" : "none"}
                            disabled={shouldDisableSizeMinorMap || displayStore.isSizeMinorColumnMinLocked}
                            variant="minimal"
                            onClick={displayStore.toggleSizeColumnMinLock}
                        />
                    </div>
                    <div className="numeric-input-lock">
                        <ClearableNumericInputComponent
                            label="Clip max"
                            min={displayStore.sizeColumnMin.clipd}
                            integerOnly={false}
                            value={displayStore.sizeColumnMax.clipd ?? 0}
                            onValueChanged={val => displayStore.setSizeColumnMax(val, "clipd")}
                            onValueCleared={() => displayStore.resetSizeColumnValue("max")}
                            displayExponential={true}
                            disabled={shouldDisableSizeMap || displayStore.isSizeMinorColumnMaxLocked}
                        />
                        <AnchorButton
                            className="lock-button"
                            icon={displayStore.isSizeColumnMaxLocked || displayStore.isSizeMinorColumnMaxLocked ? "lock" : "unlock"}
                            intent={displayStore.isSizeColumnMaxLocked ? "success" : "none"}
                            disabled={shouldDisableSizeMinorMap || displayStore.isSizeMinorColumnMaxLocked}
                            variant="minimal"
                            onClick={displayStore.toggleSizeColumnMaxLock}
                        />
                    </div>
                    <FormGroup inline={true} label="Size min" disabled={shouldDisableSizeMap}>
                        <SafeNumericInput
                            allowNumericCharactersOnly={true}
                            asyncControl={true}
                            placeholder="Min"
                            disabled={shouldDisableSizeMap}
                            buttonPosition={"none"}
                            value={displayStore.isSizeMajor ? displayStore.pointSizebyType.min : displayStore.minorPointSizebyType.min}
                            onBlur={ev => this.handleChange(ev, ValueClip.SIZE_MIN)}
                            onKeyDown={ev => this.handleChange(ev, ValueClip.SIZE_MIN)}
                        />
                        <Collapse className="select-angular-unit" isOpen={!displayStore.isSizeAreaMode}>
                            <FormGroup inline={true}>
                                <Select
                                    items={Object.values(CatalogSizeUnits)}
                                    activeItem={null}
                                    onItemSelect={units => displayStore.setCanvasSizeUnit(units)}
                                    itemRenderer={this.renderUnitPopOver}
                                    disabled={shouldDisableSizeMap}
                                    popoverProps={{minimal: true}}
                                    filterable={false}
                                    resetOnSelect={true}
                                >
                                    <Button text={displayStore.canvasSizeUnit} disabled={shouldDisableSizeMap} endIcon="double-caret-vertical" />
                                </Select>
                            </FormGroup>
                        </Collapse>
                    </FormGroup>
                    <FormGroup inline={true} label="Size max" disabled={shouldDisableSizeMap}>
                        <Tooltip content={`Maximum size ${displayStore.maxPointSizebyType}`}>
                            <SafeNumericInput
                                allowNumericCharactersOnly={true}
                                asyncControl={true}
                                placeholder="Max"
                                disabled={shouldDisableSizeMap}
                                buttonPosition={"none"}
                                value={displayStore.isSizeMajor ? displayStore.pointSizebyType.max : displayStore.minorPointSizebyType.max}
                                onBlur={ev => this.handleChange(ev, ValueClip.SIZE_MAX)}
                                onKeyDown={ev => this.handleChange(ev, ValueClip.SIZE_MAX)}
                            />
                        </Tooltip>
                        <Collapse className="select-angular-unit" isOpen={!displayStore.isSizeAreaMode}>
                            <FormGroup inline={true}>
                                <Select
                                    items={Object.values(CatalogSizeUnits)}
                                    activeItem={null}
                                    onItemSelect={units => displayStore.setCanvasSizeUnit(units)}
                                    itemRenderer={this.renderUnitPopOver}
                                    disabled={shouldDisableSizeMap}
                                    popoverProps={{minimal: true}}
                                    filterable={false}
                                    resetOnSelect={true}
                                >
                                    <Button text={displayStore.canvasSizeUnit} disabled={shouldDisableSizeMap} endIcon="double-caret-vertical" />
                                </Select>
                            </FormGroup>
                        </Collapse>
                    </FormGroup>
                </Collapse>
            </div>
        );

        const sizeMinor = (
            <div className="panel-container">
                <FormGroup inline={true} label="Column" disabled={isOverlayPanelDisabled}>
                    <Select
                        items={this.axisOption}
                        activeItem={null}
                        onItemSelect={columnName => displayStore.setSizeMinorMap(columnName)}
                        itemRenderer={this.renderAxisPopOver}
                        disabled={isOverlayPanelDisabled}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        filterable={true}
                        noResults={noResults}
                        itemPredicate={this.filterColumn}
                        resetOnSelect={true}
                    >
                        <Button text={displayStore.sizeMinorMapColumn} disabled={isOverlayPanelDisabled} endIcon="double-caret-vertical" />
                    </Select>
                </FormGroup>
                <Collapse isOpen={!shouldDisableSizeMinorMap}>
                    <FormGroup label={"Scaling"} inline={true} disabled={shouldDisableSizeMinorMap}>
                        <ScalingSelectComponent
                            selectedItem={displayStore.sizeMinorScalingType}
                            onItemSelect={type => this.handleScalingSelected(displayStore, "sizeMinorScalingType", type)}
                            onItemHover={type => this.handleScalingHovered(displayStore, "sizeMinorScalingType", type)}
                            onDropdownOpenChange={isOpen => this.handleScalingDropdownOpenChange("sizeMinorScalingType", isOpen)}
                            disabled={shouldDisableSizeMinorMap}
                        />
                    </FormGroup>
                    {this.renderScalingParameter(displayStore.sizeMinorScalingType, displayStore.sizeMinorScalingParameter, value => displayStore.setSizeMinorScalingParameter(value), shouldDisableSizeMinorMap)}
                    <FormGroup inline={true} label={"Size mode"} disabled={shouldDisableSizeMinorMap}>
                        <ButtonGroup>
                            <AnchorButton disabled={shouldDisableSizeMinorMap} text={"Diameter"} active={!displayStore.isSizeMinorAreaMode} onClick={() => displayStore.setSizeMinorArea(false)} />
                            <AnchorButton disabled={shouldDisableSizeMinorMap} text={"Area"} active={displayStore.isSizeMinorAreaMode} onClick={() => displayStore.setSizeMinorArea(true)} />
                        </ButtonGroup>
                    </FormGroup>
                    <div className="numeric-input-lock">
                        <ClearableNumericInputComponent
                            label="Clip min"
                            max={displayStore.sizeMinorColumnMax.clipd}
                            integerOnly={false}
                            value={displayStore.sizeMinorColumnMin.clipd ?? 0}
                            onValueChanged={val => displayStore.setSizeMinorColumnMin(val, "clipd")}
                            onValueCleared={() => displayStore.resetSizeMinorColumnValue("min")}
                            displayExponential={true}
                            disabled={shouldDisableSizeMinorMap || displayStore.isSizeColumnMinLocked}
                        />
                        <AnchorButton
                            className="lock-button"
                            icon={displayStore.isSizeColumnMinLocked || displayStore.isSizeMinorColumnMinLocked ? "lock" : "unlock"}
                            intent={displayStore.isSizeMinorColumnMinLocked ? "success" : "none"}
                            disabled={shouldDisableSizeMinorMap || displayStore.isSizeColumnMinLocked}
                            variant="minimal"
                            onClick={displayStore.toggleSizeMinorColumnMinLock}
                        />
                    </div>
                    <div className="numeric-input-lock">
                        <ClearableNumericInputComponent
                            label="Clip max"
                            min={displayStore.sizeMinorColumnMin.clipd}
                            integerOnly={false}
                            value={displayStore.sizeMinorColumnMax.clipd ?? 0}
                            onValueChanged={val => displayStore.setSizeMinorColumnMax(val, "clipd")}
                            onValueCleared={() => displayStore.resetSizeMinorColumnValue("max")}
                            displayExponential={true}
                            disabled={shouldDisableSizeMinorMap || displayStore.isSizeColumnMaxLocked}
                        />
                        <AnchorButton
                            className="lock-button"
                            icon={displayStore.isSizeColumnMaxLocked || displayStore.isSizeMinorColumnMaxLocked ? "lock" : "unlock"}
                            intent={displayStore.isSizeMinorColumnMaxLocked ? "success" : "none"}
                            disabled={shouldDisableSizeMinorMap || displayStore.isSizeColumnMaxLocked}
                            variant="minimal"
                            onClick={displayStore.toggleSizeMinorColumnMaxLock}
                        />
                    </div>
                    <FormGroup inline={true} label="Size min" disabled={shouldDisableSizeMap}>
                        <SafeNumericInput
                            allowNumericCharactersOnly={true}
                            asyncControl={true}
                            placeholder="Min"
                            disabled={shouldDisableSizeMap}
                            buttonPosition={"none"}
                            value={displayStore.isSizeMajor ? displayStore.pointSizebyType.min : displayStore.minorPointSizebyType.min}
                            onBlur={ev => this.handleChange(ev, ValueClip.SIZE_MIN)}
                            onKeyDown={ev => this.handleChange(ev, ValueClip.SIZE_MIN)}
                        />
                        <Collapse className="select-angular-unit" isOpen={!displayStore.isSizeAreaMode}>
                            <FormGroup inline={true}>
                                <Select
                                    items={Object.values(CatalogSizeUnits)}
                                    activeItem={null}
                                    onItemSelect={units => displayStore.setCanvasSizeUnit(units)}
                                    itemRenderer={this.renderUnitPopOver}
                                    disabled={shouldDisableSizeMap}
                                    popoverProps={{minimal: true}}
                                    filterable={false}
                                    resetOnSelect={true}
                                >
                                    <Button text={displayStore.canvasSizeUnit} disabled={shouldDisableSizeMap} endIcon="double-caret-vertical" />
                                </Select>
                            </FormGroup>
                        </Collapse>
                    </FormGroup>
                    <FormGroup inline={true} label="Size max" disabled={shouldDisableSizeMap}>
                        <Tooltip content={`Maximum size ${displayStore.maxPointSizebyType}`}>
                            <SafeNumericInput
                                allowNumericCharactersOnly={true}
                                asyncControl={true}
                                placeholder="Max"
                                disabled={shouldDisableSizeMap}
                                buttonPosition={"none"}
                                value={displayStore.isSizeMajor ? displayStore.pointSizebyType.max : displayStore.minorPointSizebyType.max}
                                onBlur={ev => this.handleChange(ev, ValueClip.SIZE_MAX)}
                                onKeyDown={ev => this.handleChange(ev, ValueClip.SIZE_MAX)}
                            />
                        </Tooltip>
                        <Collapse className="select-angular-unit" isOpen={!displayStore.isSizeAreaMode}>
                            <FormGroup inline={true}>
                                <Select
                                    items={Object.values(CatalogSizeUnits)}
                                    activeItem={null}
                                    onItemSelect={units => displayStore.setCanvasSizeUnit(units)}
                                    itemRenderer={this.renderUnitPopOver}
                                    disabled={shouldDisableSizeMap}
                                    popoverProps={{minimal: true}}
                                    filterable={false}
                                    resetOnSelect={true}
                                >
                                    <Button text={displayStore.canvasSizeUnit} disabled={shouldDisableSizeMap} endIcon="double-caret-vertical" />
                                </Select>
                            </FormGroup>
                        </Collapse>
                    </FormGroup>
                </Collapse>
            </div>
        );

        const sizeMap = (
            <div className="panel-container">
                <FormGroup inline={true} label="Size" disabled={isOverlayPanelDisabled}>
                    <Tooltip disabled={isOverlayPanelDisabled || !displayStore.isSizeMapDisabled} content={`${displayStore.minOverlaySize} ~ ${displayStore.maxOverlaySize}`}>
                        <SafeNumericInput
                            placeholder="Size"
                            disabled={isOverlayPanelDisabled || !displayStore.isSizeMapDisabled}
                            min={displayStore.minOverlaySize}
                            max={displayStore.maxOverlaySize}
                            clampValueOnBlur={true}
                            value={displayStore.showedCatalogSize}
                            stepSize={0.5}
                            minorStepSize={0.0001}
                            onValueChange={(value: number) => displayStore.setCatalogSize(value)}
                            data-testid="catalog-settings-size-input"
                        />
                    </Tooltip>
                    <Collapse className="select-angular-unit" isOpen={displayStore.isSizeMapDisabled}>
                        <FormGroup inline={true}>
                            <Select
                                items={Object.values(CatalogSizeUnits)}
                                activeItem={null}
                                onItemSelect={units => displayStore.setCanvasSizeUnit(units)}
                                itemRenderer={this.renderUnitPopOver}
                                disabled={isOverlayPanelDisabled}
                                popoverProps={{minimal: true}}
                                filterable={false}
                                resetOnSelect={true}
                            >
                                <Button text={displayStore.canvasSizeUnit} disabled={isOverlayPanelDisabled || !displayStore.isSizeMapDisabled} endIcon="double-caret-vertical" />
                            </Select>
                        </FormGroup>
                    </Collapse>
                </FormGroup>
                <FormGroup inline={true} label="Thickness" disabled={isOverlayPanelDisabled}>
                    <Tooltip disabled={isOverlayPanelDisabled} content={`${CatalogDisplayStore.MIN_THICKNESS} ~ ${CatalogDisplayStore.MAX_THICKNESS}`}>
                        <SafeNumericInput
                            placeholder="Thickness"
                            disabled={isOverlayPanelDisabled}
                            min={CatalogDisplayStore.MIN_THICKNESS}
                            max={CatalogDisplayStore.MAX_THICKNESS}
                            clampValueOnBlur={true}
                            value={displayStore.thickness}
                            stepSize={0.5}
                            onValueChange={(value: number) => displayStore.setThickness(value)}
                            data-testid="catalog-settings-thickness-input"
                        />
                    </Tooltip>
                </FormGroup>
                <Tabs id="catalogSettings" vertical={false} selectedTabId={displayStore.sizeAxisTabId} onChange={tabId => this.handleSelectedAxisTabChanged(tabId)}>
                    <Tab id={CatalogSettingsTabs.SIZE_MAJOR} title="Major" panel={sizeMajor} />
                    <Tab id={CatalogSettingsTabs.SIZE_MINOR} title="Minor" panel={sizeMinor} disabled={!displayStore.isSizeMinorTabEnabled} />
                </Tabs>
            </div>
        );

        const angularSizePanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Major" disabled={isOverlayPanelDisabled}>
                    <Select
                        items={this.axisOption}
                        activeItem={null}
                        onItemSelect={columnName => displayStore.setSizeMap(columnName)}
                        itemRenderer={this.renderAxisPopOver}
                        disabled={isOverlayPanelDisabled}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        filterable={true}
                        noResults={noResults}
                        itemPredicate={this.filterColumn}
                        resetOnSelect={true}
                    >
                        <Button text={displayStore.sizeMapColumn} disabled={isOverlayPanelDisabled} endIcon="double-caret-vertical" data-testid="catalog-settings-major-size-column-dropdown" />
                    </Select>
                </FormGroup>
                <FormGroup inline={true} label="Minor" disabled={!displayStore.isSizeMinorTabEnabled}>
                    <Select
                        items={this.axisOption}
                        activeItem={null}
                        onItemSelect={columnName => displayStore.setSizeMinorMap(columnName)}
                        itemRenderer={this.renderAxisPopOver}
                        disabled={!displayStore.isSizeMinorTabEnabled}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        filterable={true}
                        noResults={noResults}
                        itemPredicate={this.filterColumn}
                        resetOnSelect={true}
                    >
                        <Button text={displayStore.sizeMinorMapColumn} disabled={!displayStore.isSizeMinorTabEnabled} endIcon="double-caret-vertical" />
                    </Select>
                </FormGroup>
                <FormGroup inline={true} label="Unit">
                    <Select
                        items={Object.values(AngularSizeUnit).filter(item => item !== AngularSizeUnit.MILLIARCSEC)}
                        activeItem={null}
                        onItemSelect={units => displayStore.setWorldSizeUnit(units)}
                        itemRenderer={this.renderAngularUnitPopOver}
                        disabled={!displayStore.isAngularSize}
                        popoverProps={{minimal: true}}
                        filterable={false}
                        resetOnSelect={true}
                    >
                        <Button text={displayStore.worldSizeUnit} disabled={!displayStore.isAngularSize} endIcon="double-caret-vertical" />
                    </Select>
                </FormGroup>
                <FormGroup inline={true} label="Axis type">
                    <ButtonGroup>
                        {Array.from(displayStore.catalogSourceRadiusTypes.entries()).map(([type, option]) => (
                            <AnchorButton
                                key={type}
                                disabled={isOverlayPanelDisabled || !displayStore.isAngularSize}
                                text={option.label}
                                active={displayStore.catalogSourceRadiusType === type}
                                onClick={() => displayStore.setCatalogSourceRadiusType(type)}
                                data-testid={`catalog-settings-axis-type-${type}-button`}
                            />
                        ))}
                    </ButtonGroup>
                </FormGroup>
                <FormGroup inline={true} label="Thickness" disabled={isOverlayPanelDisabled}>
                    <Tooltip disabled={isOverlayPanelDisabled} content={`${CatalogDisplayStore.MIN_THICKNESS} ~ ${CatalogDisplayStore.MAX_THICKNESS}`}>
                        <SafeNumericInput
                            placeholder="Thickness"
                            disabled={isOverlayPanelDisabled}
                            min={CatalogDisplayStore.MIN_THICKNESS}
                            max={CatalogDisplayStore.MAX_THICKNESS}
                            clampValueOnBlur={true}
                            value={displayStore.thickness}
                            stepSize={0.5}
                            onValueChange={(value: number) => displayStore.setThickness(value)}
                            data-testid="catalog-settings-thickness-input"
                        />
                    </Tooltip>
                </FormGroup>
            </div>
        );

        const colorMap = (
            <div className="panel-container" data-testid="catalog-settings-color-tab">
                <FormGroup label={"Color"} inline={true} disabled={isOverlayPanelDisabled || !displayStore.isColorMapDisabled}>
                    <AutoColorPickerComponent
                        color={displayStore.catalogColor}
                        presetColors={[...SWATCH_COLORS, "transparent"]}
                        setColor={(color: string) => {
                            displayStore.setCatalogColor(color === "transparent" ? "#000000" : getColorForTheme(color));
                        }}
                        disableAlpha={true}
                        disabled={isOverlayPanelDisabled || !displayStore.isColorMapDisabled}
                    />
                </FormGroup>
                <FormGroup label={"Overlay highlight"} inline={true} disabled={isOverlayPanelDisabled}>
                    <AutoColorPickerComponent
                        color={displayStore.highlightColor}
                        presetColors={[...SWATCH_COLORS, "transparent"]}
                        setColor={(color: string) => {
                            displayStore.setHighlightColor(color === "transparent" ? "#000000" : getColorForTheme(color));
                        }}
                        disableAlpha={true}
                        disabled={isOverlayPanelDisabled}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Column" disabled={isOverlayPanelDisabled}>
                    <Select
                        items={this.axisOption}
                        activeItem={null}
                        onItemSelect={columnName => displayStore.setColorMapColumn(columnName)}
                        itemRenderer={this.renderAxisPopOver}
                        disabled={isOverlayPanelDisabled}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        filterable={true}
                        noResults={noResults}
                        itemPredicate={this.filterColumn}
                        resetOnSelect={true}
                    >
                        <Button text={displayStore.colorMapColumn} disabled={isOverlayPanelDisabled} endIcon="double-caret-vertical" data-testid="catalog-settings-color-column-dropdown" />
                    </Select>
                </FormGroup>
                <Collapse isOpen={!shouldDisableColorMap}>
                    <FormGroup label={"Scaling"} inline={true} disabled={shouldDisableColorMap}>
                        <ScalingSelectComponent
                            selectedItem={displayStore.colorScalingType}
                            onItemSelect={type => this.handleScalingSelected(displayStore, "colorScalingType", type)}
                            onItemHover={type => this.handleScalingHovered(displayStore, "colorScalingType", type)}
                            onDropdownOpenChange={isOpen => this.handleScalingDropdownOpenChange("colorScalingType", isOpen)}
                            disabled={shouldDisableColorMap}
                        />
                    </FormGroup>
                    {this.renderScalingParameter(displayStore.colorScalingType, displayStore.colorScalingParameter, value => displayStore.setColorScalingParameter(value), shouldDisableColorMap)}
                    <FormGroup inline={true} label="Colormap" disabled={shouldDisableColorMap}>
                        <ColormapComponent
                            inverted={displayStore.isInvertedColorMap}
                            selectedColormap={displayStore.colorMap}
                            onColormapSelect={selected => this.handleColormapSelected(displayStore, selected)}
                            onColormapHover={colormap => this.handleColormapHovered(displayStore, colormap)}
                            onDropdownOpenChange={isOpen => this.handleColormapDropdownOpenChange(isOpen)}
                            disabled={shouldDisableColorMap}
                        />
                    </FormGroup>
                    <FormGroup label={"Invert colormap"} inline={true} disabled={shouldDisableColorMap}>
                        <Switch checked={displayStore.isInvertedColorMap} onChange={ev => displayStore.setColorMapDirection(ev.currentTarget.checked)} disabled={shouldDisableColorMap} data-testid="catalog-settings-invert-colormap-toggle" />
                    </FormGroup>
                    <ClearableNumericInputComponent
                        label="Clip min"
                        max={displayStore.colorColumnMax.clipd}
                        integerOnly={false}
                        value={displayStore.colorColumnMin.clipd ?? 0}
                        onValueChanged={val => displayStore.setColorColumnMin(val, "clipd")}
                        onValueCleared={() => displayStore.resetColorColumnValue("min")}
                        displayExponential={true}
                        disabled={shouldDisableColorMap}
                    />
                    <ClearableNumericInputComponent
                        label="Clip max"
                        min={displayStore.colorColumnMin.clipd}
                        integerOnly={false}
                        value={displayStore.colorColumnMax.clipd ?? 0}
                        onValueChanged={val => displayStore.setColorColumnMax(val, "clipd")}
                        onValueCleared={() => displayStore.resetColorColumnValue("max")}
                        displayExponential={true}
                        disabled={shouldDisableColorMap}
                    />
                </Collapse>
            </div>
        );

        const orientationMap = (
            <div className="panel-container">
                <FormGroup
                    inline={true}
                    label={displayStore.catalogDisplayMode === CatalogDisplayMode.WORLD ? "P.A." : "Column"}
                    labelInfo={displayStore.catalogDisplayMode === CatalogDisplayMode.WORLD ? "(deg)" : ""}
                    disabled={isOverlayPanelDisabled}
                >
                    <Select
                        items={this.axisOption}
                        activeItem={null}
                        onItemSelect={columnName => displayStore.setOrientationMapColumn(columnName)}
                        itemRenderer={this.renderAxisPopOver}
                        disabled={isOverlayPanelDisabled}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        filterable={true}
                        noResults={noResults}
                        itemPredicate={this.filterColumn}
                        resetOnSelect={true}
                    >
                        <Button text={displayStore.orientationMapColumn} disabled={isOverlayPanelDisabled} endIcon="double-caret-vertical" data-testid="catalog-settings-orientation-column-dropdown" />
                    </Select>
                </FormGroup>
                <Collapse isOpen={!shouldDisableOrientationMap && displayStore.catalogDisplayMode !== CatalogDisplayMode.WORLD}>
                    <FormGroup label={"Scaling"} inline={true} disabled={shouldDisableOrientationMap}>
                        <ScalingSelectComponent
                            selectedItem={displayStore.orientationScalingType}
                            onItemSelect={type => this.handleScalingSelected(displayStore, "orientationScalingType", type)}
                            onItemHover={type => this.handleScalingHovered(displayStore, "orientationScalingType", type)}
                            onDropdownOpenChange={isOpen => this.handleScalingDropdownOpenChange("orientationScalingType", isOpen)}
                            disabled={shouldDisableOrientationMap}
                        />
                    </FormGroup>
                    {this.renderScalingParameter(displayStore.orientationScalingType, displayStore.orientationScalingParameter, value => displayStore.setOrientationScalingParameter(value), shouldDisableOrientationMap)}
                    <FormGroup inline={true} label="Orientation" labelInfo="(degree)" disabled={shouldDisableOrientationMap}>
                        <div className="parameter-container">
                            <FormGroup inline={true} label="Min">
                                <SafeNumericInput
                                    allowNumericCharactersOnly={true}
                                    asyncControl={true}
                                    placeholder="Min"
                                    disabled={shouldDisableOrientationMap}
                                    buttonPosition={"none"}
                                    value={displayStore.angleMin}
                                    onBlur={ev => this.handleChange(ev, ValueClip.ANGLE_MIN)}
                                    onKeyDown={ev => this.handleChange(ev, ValueClip.ANGLE_MIN)}
                                />
                            </FormGroup>
                            <FormGroup inline={true} label="Max">
                                <SafeNumericInput
                                    allowNumericCharactersOnly={true}
                                    asyncControl={true}
                                    placeholder="Max"
                                    disabled={shouldDisableOrientationMap}
                                    buttonPosition={"none"}
                                    value={displayStore.angleMax}
                                    onBlur={ev => this.handleChange(ev, ValueClip.ANGLE_MAX)}
                                    onKeyDown={ev => this.handleChange(ev, ValueClip.ANGLE_MAX)}
                                />
                            </FormGroup>
                        </div>
                    </FormGroup>
                    <ClearableNumericInputComponent
                        label="Clip min"
                        max={displayStore.orientationMax.clipd}
                        integerOnly={false}
                        value={displayStore.orientationMin.clipd ?? 0}
                        onValueChanged={val => displayStore.setOrientationMin(val, "clipd")}
                        onValueCleared={() => displayStore.resetOrientationValue("min")}
                        displayExponential={true}
                        disabled={shouldDisableOrientationMap}
                    />
                    <ClearableNumericInputComponent
                        label="Clip max"
                        min={displayStore.orientationMin.clipd}
                        integerOnly={false}
                        value={displayStore.orientationMax.clipd ?? 0}
                        onValueChanged={val => displayStore.setOrientationMax(val, "clipd")}
                        onValueCleared={() => displayStore.resetOrientationValue("max")}
                        displayExponential={true}
                        disabled={shouldDisableOrientationMap}
                    />
                </Collapse>
            </div>
        );

        return (
            <ScrollShadow>
                <div className={"catalog-settings"}>
                    <FormGroup className={"file-menu"} inline={true} label="File" disabled={isOverlayPanelDisabled}>
                        <Select
                            className={Classes.FILL}
                            disabled={isOverlayPanelDisabled}
                            filterable={false}
                            items={catalogFileItems}
                            activeItem={this.catalogFileId}
                            onItemSelect={this.handleCatalogFileChange}
                            itemRenderer={this.renderFileIdPopOver}
                            popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                            fill={true}
                        >
                            <Button text={activeFileName} endIcon="double-caret-vertical" disabled={isOverlayPanelDisabled} />
                        </Select>
                    </FormGroup>
                    <FormGroup className={"file-menu"} inline={true} label="Shape" disabled={isOverlayPanelDisabled}>
                        <Select
                            className={Classes.FILL}
                            disabled={isOverlayPanelDisabled}
                            filterable={false}
                            items={
                                displayStore.catalogDisplayMode === CatalogDisplayMode.WORLD
                                    ? this.catalogOverlayShape.filter(f => f === CatalogOverlayShape.ELLIPSE_LINED || f === CatalogOverlayShape.CIRCLE_LINED)
                                    : this.catalogOverlayShape
                            }
                            activeItem={displayStore.catalogShape}
                            onItemSelect={item => displayStore.setCatalogShape(item)}
                            itemRenderer={this.renderShapePopOver}
                            popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        >
                            <Button icon={this.getCatalogShape(displayStore.catalogShape)} endIcon="double-caret-vertical" disabled={isOverlayPanelDisabled} data-testid="catalog-settings-shape-dropdown" />
                        </Select>
                    </FormGroup>
                    <FormGroup className={"file-menu"} inline={true} label="Mode" disabled={isOverlayPanelDisabled}>
                        <ButtonGroup>
                            <AnchorButton
                                onClick={() => displayStore.setCatalogDisplayMode(CatalogDisplayMode.CANVAS)}
                                text={CatalogDisplayMode.CANVAS}
                                active={displayStore.catalogDisplayMode === CatalogDisplayMode.CANVAS}
                                disabled={isOverlayPanelDisabled}
                            />
                            <AnchorButton
                                onClick={() => displayStore.setCatalogDisplayMode(CatalogDisplayMode.WORLD)}
                                text={CatalogDisplayMode.WORLD}
                                active={displayStore.catalogDisplayMode === CatalogDisplayMode.WORLD}
                                disabled={isOverlayPanelDisabled}
                            />
                        </ButtonGroup>
                    </FormGroup>
                    <Tabs id="catalogSettings" vertical={false} selectedTabId={this.widgetStore?.settingsTabId} onChange={tabId => this.handleSelectedTabChanged(tabId)}>
                        <Tab id={CatalogSettingsTabs.SIZE} title="Size" panel={displayStore.catalogDisplayMode === CatalogDisplayMode.WORLD ? angularSizePanel : sizeMap} disabled={isOverlayPanelDisabled} />
                        <Tab id={CatalogSettingsTabs.COLOR} title="Color" panel={colorMap} disabled={isOverlayPanelDisabled} data-testid="catalog-settings-color-tab-title" />
                        <Tab id={CatalogSettingsTabs.ORIENTATION} title="Orientation" panel={orientationMap} disabled={isOverlayPanelDisabled} data-testid="catalog-settings-orientation-tab-title" />
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
        if (ev.type === "keydown" && ev.key !== "Enter") {
            return;
        }
        const val = parseFloat(ev.currentTarget.value);
        const displayStore = this.displayStore;
        if (!displayStore) {
            return;
        }
        const pointSize = displayStore.isSizeMajor ? displayStore.pointSizebyType : displayStore.minorPointSizebyType;

        switch (type) {
            case ValueClip.SIZE_MIN:
                if (isFinite(val) && val !== pointSize.min && val < pointSize.max && val >= CatalogDisplayStore.SIZE_MAP_MIN) {
                    const inputVal = val;
                    if (displayStore.sizeAxisTabId === CatalogSettingsTabs.SIZE_MINOR) {
                        displayStore.setMinorSizeMin(inputVal);
                    } else {
                        displayStore.setSizeMin(inputVal);
                    }
                } else {
                    ev.currentTarget.value = pointSize.min.toString();
                }
                break;
            case ValueClip.SIZE_MAX:
                if (isFinite(val) && val !== pointSize.max && val > pointSize.min && val <= displayStore.maxPointSizebyType) {
                    const inputVal = val;
                    if (displayStore.sizeAxisTabId === CatalogSettingsTabs.SIZE_MINOR) {
                        displayStore.setMinorSizeMax(inputVal);
                    } else {
                        displayStore.setSizeMax(inputVal);
                    }
                } else {
                    ev.currentTarget.value = pointSize.max.toString();
                }
                break;
            case ValueClip.ANGLE_MIN:
                if (isFinite(val) && val < displayStore.angleMax) {
                    displayStore.setAngleMin(val);
                } else {
                    ev.currentTarget.value = displayStore.angleMin.toString();
                }
                break;
            case ValueClip.ANGLE_MAX:
                if (isFinite(val) && val > displayStore.angleMin) {
                    displayStore.setAngleMax(val);
                } else {
                    ev.currentTarget.value = displayStore.angleMax.toString();
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

    private handleSelectedTabChanged(newTabId: string | number) {
        this.widgetStore?.setSettingsTabId(Number.parseInt(newTabId.toString()) as CatalogSettingsTabs);
        this.displayStore?.setSizeAxisTab(CatalogSettingsTabs.SIZE_MAJOR);
    }

    private handleSelectedAxisTabChanged = (newTabId: string | number) => {
        this.displayStore?.setSizeAxisTab(Number.parseInt(newTabId.toString()));
    };

    private getCatalogShape = (shape: CatalogOverlayShape) => {
        const displayStore = this.displayStore;
        const color = displayStore?.catalogColor ?? Colors.TURQUOISE3;
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
