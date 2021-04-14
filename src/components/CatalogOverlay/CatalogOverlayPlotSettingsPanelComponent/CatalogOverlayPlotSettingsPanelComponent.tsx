import {observer} from "mobx-react";
import FuzzySearch from "fuzzy-search";
import {action, autorun, computed, makeObservable} from "mobx";
import * as React from "react";
import {AnchorButton, Button, ButtonGroup, FormGroup, Icon, MenuItem, PopoverPosition, Switch, Tab, Tabs, Tooltip} from "@blueprintjs/core";
import {Select, IItemRendererProps, ItemPredicate} from "@blueprintjs/select";
import {AppStore, CatalogStore, CatalogProfileStore, CatalogOverlay, DefaultWidgetConfig, HelpType, PreferenceStore, PreferenceKeys, WidgetProps, WidgetsStore} from "stores";
import {CatalogOverlayShape, CatalogWidgetStore, CatalogSettingsTabs, ValueClip} from "stores/widgets";
import {ColorResult} from "react-color";
import {CatalogOverlayComponent} from "components";
import {ColorPickerComponent, ClearableNumericInputComponent, ColormapComponent, SafeNumericInput, ScalingSelectComponent} from "components/Shared";
import {SWATCH_COLORS} from "utilities";
import "./CatalogOverlayPlotSettingsPanelComponent.scss";

const IconWrapper = (path: React.SVGProps<SVGPathElement>, color: string, fill: boolean, strokeWidth = 2, viewboxDefault = 16) => {
    let fillColor = color;
    if (!fill) {
        fillColor = "none";
    }
    return (
        <span className="bp3-icon">
            <svg
                data-icon="triangle-up-open"
                width="16"
                height="16"
                viewBox={`0 0 ${viewboxDefault} ${viewboxDefault}`}
                style={{stroke: color, fill: fillColor, strokeWidth: strokeWidth}}
            >
                {path}
            </svg>
        </span>
    );
};

const triangleUp = <path d="M 2 14 L 14 14 L 8 3 Z"/>;
const triangleDown = <path d="M 2 2 L 14 2 L 8 13 Z"/>;
const rhomb = <path d="M 8 14 L 14 8 L 8 2 L 2 8 Z"/>;
const hexagon2 = <path d="M 12.33 5.5 L 12.33 10.5 L 8 13 L 3.67 10.5 L 3.67 5.5 L 8 3 Z"/>;
const hexagon = <path d="M 3 8 L 5.5 3.67 L 10.5 3.67 L 13 8 L 10.5 12.33 L 5.5 12.33 Z"/>;
const ellipse = <ellipse cx="8" cy="8" rx="4" ry="7"/>;
const KEYCODE_ENTER = 13;

@observer
export class CatalogOverlayPlotSettingsPanelComponent extends React.Component<WidgetProps> {

    private catalogFileNames: Map<number, string>;
    private catalogOverlayShape: Array<CatalogOverlayShape> = [
        CatalogOverlayShape.BoxLined,
        CatalogOverlayShape.CircleFilled,
        CatalogOverlayShape.CircleLined,
        CatalogOverlayShape.CrossFilled,
        CatalogOverlayShape.EllipseLined,
        CatalogOverlayShape.HexagonLined,
        CatalogOverlayShape.HexagonLined2,
        CatalogOverlayShape.RhombLined,
        CatalogOverlayShape.TriangleDownLined,
        CatalogOverlayShape.TriangleUpLined,
        CatalogOverlayShape.XFilled,
        CatalogOverlayShape.LineSegmentFILLED
    ];

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "catalog-overlay-floating-settings",
            type: "floating-settings",
            minWidth: 350,
            minHeight: 250,
            defaultWidth: 400,
            defaultHeight: 560,
            title: "catalog-overlay-settings",
            isCloseable: true,
            parentId: "catalog-overlay",
            parentType: "catalog-overlay",
            helpType: [HelpType.CATALOG_SETTINGS_GOLBAL, HelpType.CATALOG_SETTINGS_OVERLAY, HelpType.CATALOG_SETTINGS_COLOR]
        };
    }

    @computed get widgetStore(): CatalogWidgetStore {
        const catalogStore = CatalogStore.Instance;
        const catalogWidgetStoreId = catalogStore.catalogWidgets.get(this.catalogFileId);
        return WidgetsStore.Instance.catalogWidgets.get(catalogWidgetStoreId);
    }

    @computed get catalogFileId() {
        return CatalogStore.Instance.catalogProfiles?.get(this.props.id);
    }

    @computed get profileStore(): CatalogProfileStore {
        return CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
    }

    @computed get axisOption() {
        const profileStore = this.profileStore;
        let axisOptions = [];
        axisOptions.push(CatalogOverlay.NONE);
        profileStore?.catalogControlHeader.forEach((header, columnName) => {
            const dataType = profileStore.catalogHeader[header.dataIndex].dataType;
            if (CatalogOverlayComponent.axisDataType.includes(dataType) && header.display) {
                axisOptions.push(columnName);
            }
        });
        return axisOptions;
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        const appStore = AppStore.Instance;
        this.catalogFileNames = new Map<number, string>();
        autorun(() => {
            const catalogStore = CatalogStore.Instance;
            const catalogWidgetStoreId = catalogStore.catalogWidgets.get(this.catalogFileId);
            const activeFiles = catalogStore.activeCatalogFiles;
            if (!catalogWidgetStoreId) {
                WidgetsStore.Instance.addCatalogWidget(this.catalogFileId);
            }

            if (activeFiles?.includes(this.catalogFileId)) {
                const fileName = catalogStore.getCatalogFileNames([this.catalogFileId]).get(this.catalogFileId);
                if (fileName) {
                    appStore.widgetsStore.setWidgetTitle(this.props.floatingSettingsId, `Catalog Settings: ${fileName}`);
                }
            } else {
                appStore.widgetsStore.setWidgetTitle(this.props.floatingSettingsId, `Catalog Settings`);
            }
        });
    }

    @action handleCatalogFileChange = (fileId: number) => {
        CatalogStore.Instance.catalogProfiles.set(this.props.id, fileId);
    }

    public render() {
        const appStore = AppStore.Instance;
        const widgetStore = this.widgetStore;
        const catalogStore = CatalogStore.Instance;
        const catalogFileIds = catalogStore.activeCatalogFiles;

        let catalogFileItems = [];
        catalogFileIds.forEach((value) => {
            catalogFileItems.push(value);
        });
        this.catalogFileNames = CatalogStore.Instance.getCatalogFileNames(catalogFileIds);
        const fileName = this.catalogFileNames.get(this.catalogFileId);
        let activeFileName = "";
        if (fileName !== undefined) {
            activeFileName = `${this.catalogFileId}: ${fileName}`;
        }
        const disabledOverlayPanel = catalogFileIds.length <= 0;
        const disableSizeMap = disabledOverlayPanel || widgetStore.disableSizeMap;
        const disableColorMap = disabledOverlayPanel || widgetStore.disableColorMap;
        const disableOrientationMap = disabledOverlayPanel || widgetStore.disableOrientationMap;
        const disableSizeMinorMap = disableSizeMap || widgetStore.disableSizeMinorMap;

        const globalPanel = (
            <div className="panel-container">
                <FormGroup  inline={true} label="Displayed columns">
                    <SafeNumericInput
                        placeholder="Default Displayed Columns"
                        min={1}
                        value={PreferenceStore.Instance.catalogDisplayedColumnSize}
                        stepSize={1}
                        onValueChange={(value: number) => PreferenceStore.Instance.setPreference(PreferenceKeys.CATALOG_DISPLAYED_COLUMN_SIZE, value)}
                    />
                </FormGroup>
            </div>
        );

        const overlayPanel = (
            <div className="panel-container">
                <FormGroup label={"Color"} inline={true}  disabled={disabledOverlayPanel}>
                    <ColorPickerComponent
                        color={widgetStore.catalogColor}
                        presetColors={[...SWATCH_COLORS, "transparent"]}
                        setColor={(color: ColorResult) => {
                            widgetStore.setCatalogColor(color.hex === "transparent" ? "#000000" : color.hex);
                        }}
                        disableAlpha={true}
                        darkTheme={appStore.darkTheme}
                        disabled={disabledOverlayPanel}
                    />
                </FormGroup>
                <FormGroup label={"Overlay Highlight"} inline={true}  disabled={disabledOverlayPanel}>
                    <ColorPickerComponent
                        color={widgetStore.highlightColor}
                        presetColors={[...SWATCH_COLORS, "transparent"]}
                        setColor={(color: ColorResult) => {
                            widgetStore.setHighlightColor(color.hex === "transparent" ? "#000000" : color.hex);
                        }}
                        disableAlpha={true}
                        darkTheme={appStore.darkTheme}
                        disabled={disabledOverlayPanel}
                    />
                </FormGroup>
                <FormGroup  inline={true} label="Size" labelInfo="(px)"  disabled={disabledOverlayPanel}>
                    <SafeNumericInput
                        className="catalog-size-overlay"
                        placeholder="Size"
                        disabled={disabledOverlayPanel || !widgetStore.disableSizeMap}
                        min={CatalogWidgetStore.MinOverlaySize}
                        max={CatalogWidgetStore.MaxOverlaySize}
                        value={widgetStore.catalogSize}
                        stepSize={0.5}
                        onValueChange={(value: number) => widgetStore.setCatalogSize(value)}
                    />
                </FormGroup>
                <FormGroup  inline={true} label="Thickness" disabled={disabledOverlayPanel}>
                    <SafeNumericInput
                        className="catalog-size-overlay"
                        placeholder="Thickness"
                        disabled={disabledOverlayPanel}
                        min={CatalogWidgetStore.MinThickness}
                        max={CatalogWidgetStore.MaxThickness}
                        value={widgetStore.thickness}
                        stepSize={0.5}
                        onValueChange={(value: number) => widgetStore.setThickness(value)}
                    />
                </FormGroup>
            </div>
        );

        const noResults = (<MenuItem disabled={true} text="No results" />);
        
        const sizeMajor = (
            <div className="panel-container">
                <FormGroup inline={true} label="Column" disabled={disabledOverlayPanel}>
                    <Select
                        items={this.axisOption}
                        activeItem={null}
                        onItemSelect={(columnName) => widgetStore.setSizeMap(columnName)}
                        itemRenderer={this.renderAxisPopOver}
                        disabled={disabledOverlayPanel}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                        filterable={true}
                        noResults={noResults}
                        itemPredicate={this.filterColumn}
                        resetOnSelect={true}
                    >
                        <Button text={widgetStore.sizeMapColumn} disabled={disabledOverlayPanel} rightIcon="double-caret-vertical"/>
                    </Select>
                </FormGroup>
                <FormGroup label={"Scaling"} inline={true}>
                    <ScalingSelectComponent
                        selectedItem={widgetStore.sizeScalingType}
                        onItemSelect={(type) => widgetStore.setSizeScalingType(type)}
                    />
                </FormGroup>
                <FormGroup inline={true} label={"Size Mode"} disabled={disableSizeMap}>
                    <ButtonGroup>
                        <AnchorButton disabled={disableSizeMap} text={"Diameter"} active={!widgetStore.sizeArea} onClick={() => widgetStore.setSizeArea(false)}/>
                        <AnchorButton disabled={disableSizeMap} text={"Area"} active={widgetStore.sizeArea} onClick={() => widgetStore.setSizeArea(true)}/>
                    </ButtonGroup>
                </FormGroup>
                <ClearableNumericInputComponent
                    label="Clip Min"
                    max={widgetStore.sizeColumnMax.clipd}
                    integerOnly={false}
                    value={widgetStore.sizeColumnMin.clipd}
                    onValueChanged={val => widgetStore.setSizeColumnMin(val, "clipd")}
                    onValueCleared={() => widgetStore.resetSizeColumnValue("min")}
                    displayExponential={true}
                    disabled={disableSizeMap}
                />
                <ClearableNumericInputComponent
                    label="Clip Max"
                    min={widgetStore.sizeColumnMin.clipd}
                    integerOnly={false}
                    value={widgetStore.sizeColumnMax.clipd}
                    onValueChanged={val => widgetStore.setSizeColumnMax(val, "clipd")}
                    onValueCleared={() => widgetStore.resetSizeColumnValue("max")}
                    displayExponential={true}
                    disabled={disableSizeMap}
                />
            </div>
        );

        const sizeMinor = (
            <div className="panel-container">
                <FormGroup inline={true} label="Column" disabled={disabledOverlayPanel}>
                    <Select
                        items={this.axisOption}
                        activeItem={null}
                        onItemSelect={(columnName) => widgetStore.setSizeMinorMap(columnName)}
                        itemRenderer={this.renderAxisPopOver}
                        disabled={disabledOverlayPanel}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                        filterable={true}
                        noResults={noResults}
                        itemPredicate={this.filterColumn}
                        resetOnSelect={true}
                    >
                        <Button text={widgetStore.sizeMinorMapColumn} disabled={disabledOverlayPanel} rightIcon="double-caret-vertical"/>
                    </Select>
                </FormGroup>
                <FormGroup label={"Scaling"} inline={true}>
                    <ScalingSelectComponent
                        selectedItem={widgetStore.sizeMinorScalingType}
                        onItemSelect={(type) => widgetStore.setSizeMinorScalingType(type)}
                    />
                </FormGroup>
                <FormGroup inline={true} label={"Size Mode"} disabled={disableSizeMinorMap}>
                    <ButtonGroup>
                        <AnchorButton disabled={disableSizeMinorMap} text={"Diameter"} active={!widgetStore.sizeMinorArea} onClick={() => widgetStore.setSizeMinorArea(false)}/>
                        <AnchorButton disabled={disableSizeMinorMap} text={"Area"} active={widgetStore.sizeMinorArea} onClick={() => widgetStore.setSizeMinorArea(true)}/>
                    </ButtonGroup>
                </FormGroup>
                <ClearableNumericInputComponent
                    label="Clip Min"
                    max={widgetStore.sizeMinorColumnMax.clipd}
                    integerOnly={false}
                    value={widgetStore.sizeMinorColumnMin.clipd}
                    onValueChanged={val => widgetStore.setSizeMinorColumnMin(val, "clipd")}
                    onValueCleared={() => widgetStore.resetSizeMinorColumnValue("min")}
                    displayExponential={true}
                    disabled={disableSizeMinorMap}
                />
                <ClearableNumericInputComponent
                    label="Clip Max"
                    min={widgetStore.sizeMinorColumnMin.clipd}
                    integerOnly={false}
                    value={widgetStore.sizeMinorColumnMax.clipd}
                    onValueChanged={val => widgetStore.setSizeMinorColumnMax(val, "clipd")}
                    onValueCleared={() => widgetStore.resetSizeMinorColumnValue("max")}
                    displayExponential={true}
                    disabled={disableSizeMinorMap}
                />
            </div>
        );

        const sizeMap = (
            <div className="panel-container">
                <Tabs
                    id="catalogSettings"
                    vertical={false}
                    selectedTabId={widgetStore.sizeAxisTabId}
                    onChange={(tabId) => this.handleSelectedAxisTabChanged(tabId)}
                >
                    <Tab id={CatalogSettingsTabs.SIZE_MAJOR} title="Major" panel={sizeMajor}/>
                    <Tab id={CatalogSettingsTabs.SIZE_MINOR} title="Minor" panel={sizeMinor} disabled = {!widgetStore.enableSizeMinorTab}/>
                </Tabs>
                <FormGroup  inline={true} label="Size Min" labelInfo="(px)"  disabled={disableSizeMap}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={true}
                        asyncControl={true}
                        placeholder="Min"
                        disabled={disableSizeMap}
                        buttonPosition={"none"}
                        value={widgetStore.sizeMajor? widgetStore.pointSizebyType.min : widgetStore.minorPointSizebyType.min}
                        onBlur={(ev) => this.handleChange(ev, "size-min")}
                        onKeyDown={(ev) => this.handleChange(ev, "size-min")}
                    />
                </FormGroup>
                <FormGroup  inline={true} label="Size Max" labelInfo="(px)"  disabled={disableSizeMap}>
                    <Tooltip content = {`Maximum size ${widgetStore.maxPointSizebyType}`}>
                        <SafeNumericInput
                            allowNumericCharactersOnly={true}
                            asyncControl={true}
                            placeholder="Max"
                            disabled={disableSizeMap}
                            buttonPosition={"none"}
                            value={widgetStore.sizeMajor? widgetStore.pointSizebyType.max : widgetStore.minorPointSizebyType.max}
                            onBlur={(ev) => this.handleChange(ev, "size-max")}
                            onKeyDown={(ev) => this.handleChange(ev, "size-max")}
                        />
                    </Tooltip>
                </FormGroup>
            </div>
        )

        const colorMap = (
            <div className="panel-container">
                <FormGroup inline={true} label="Column" disabled={disabledOverlayPanel}>
                    <Select
                        items={this.axisOption}
                        activeItem={null}
                        onItemSelect={(columnName) => widgetStore.setColorMapColumn(columnName)}
                        itemRenderer={this.renderAxisPopOver}
                        disabled={disabledOverlayPanel}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                        filterable={true}
                        noResults={noResults}
                        itemPredicate={this.filterColumn}
                        resetOnSelect={true}
                    >
                        <Button text={widgetStore.colorMapColumn} disabled={disabledOverlayPanel} rightIcon="double-caret-vertical"/>
                    </Select>
                </FormGroup>
                <FormGroup label={"Scaling"} inline={true}>
                    <ScalingSelectComponent
                        selectedItem={widgetStore.colorScalingType}
                        onItemSelect={(type) => widgetStore.setColorScalingType(type)}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Color Map">
                    <ColormapComponent
                        inverted={false}
                        selectedItem={widgetStore.colorMap}
                        onItemSelect={(selected) => widgetStore.setColorMap(selected)}
                    />
                </FormGroup>
                <FormGroup label={"Invert Color Map"} inline={true}>
                    <Switch
                        checked={widgetStore.invertedColorMap}
                        onChange={(ev) => widgetStore.setColorMapDirection(ev.currentTarget.checked)}
                    />
                </FormGroup>
                <ClearableNumericInputComponent
                    label="Clip Min"
                    max={widgetStore.colorColumnMax.clipd}
                    integerOnly={false}
                    value={widgetStore.colorColumnMin.clipd}
                    onValueChanged={val => widgetStore.setColorColumnMin(val, "clipd")}
                    onValueCleared={() => widgetStore.resetColorColumnValue("min")}
                    displayExponential={true}
                    disabled={disableColorMap}
                />
                <ClearableNumericInputComponent
                    label="Clip Max"
                    min={widgetStore.colorColumnMin.clipd}
                    integerOnly={false}
                    value={widgetStore.colorColumnMax.clipd}
                    onValueChanged={val => widgetStore.setColorColumnMax(val, "clipd")}
                    onValueCleared={() => widgetStore.resetColorColumnValue("max")}
                    displayExponential={true}
                    disabled={disableColorMap}
                />
            </div>
        );

        const orientationMap = (
            <div className="panel-container">
                <FormGroup inline={true} label="Column" disabled={disabledOverlayPanel}>
                    <Select
                        items={this.axisOption}
                        activeItem={null}
                        onItemSelect={(columnName) => widgetStore.setOrientationMapColumn(columnName)}
                        itemRenderer={this.renderAxisPopOver}
                        disabled={disabledOverlayPanel}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                        filterable={true}
                        noResults={noResults}
                        itemPredicate={this.filterColumn}
                        resetOnSelect={true}
                    >
                        <Button text={widgetStore.orientationMapColumn} disabled={disabledOverlayPanel} rightIcon="double-caret-vertical"/>
                    </Select>
                </FormGroup>
                <FormGroup label={"Scaling"} inline={true}>
                    <ScalingSelectComponent
                        selectedItem={widgetStore.orientationScalingType}
                        onItemSelect={(type) => widgetStore.setOrientationScalingType(type)}
                    />
                </FormGroup>
                <FormGroup  inline={true} label="Orientation Min" labelInfo="(degree)"  disabled={disableOrientationMap}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={true}
                        asyncControl={true}
                        placeholder="Min"
                        disabled={disableOrientationMap}
                        buttonPosition={"none"}
                        value={widgetStore.angleMin}
                        onBlur={(ev) => this.handleChange(ev, "angle-min")}
                        onKeyDown={(ev) => this.handleChange(ev, "angle-min")}
                    />
                </FormGroup>
                <FormGroup  inline={true} label="Orientation Max" labelInfo="(degree)"  disabled={disableOrientationMap}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={true}
                        asyncControl={true}
                        placeholder="Max"
                        disabled={disableOrientationMap}
                        buttonPosition={"none"}
                        value={widgetStore.angleMax}
                        onBlur={(ev) => this.handleChange(ev, "angle-max")}
                        onKeyDown={(ev) => this.handleChange(ev, "angle-max")}
                    />
                </FormGroup>
                <ClearableNumericInputComponent
                    label="Clip Min"
                    max={widgetStore.orientationMax.clipd}
                    integerOnly={false}
                    value={widgetStore.orientationMin.clipd}
                    onValueChanged={val => widgetStore.setOrientationMin(val, "clipd")}
                    onValueCleared={() => widgetStore.resetOrientationValue("min")}
                    displayExponential={true}
                    disabled={disableOrientationMap}
                />
                <ClearableNumericInputComponent
                    label="Clip Max"
                    min={widgetStore.orientationMin.clipd}
                    integerOnly={false}
                    value={widgetStore.orientationMax.clipd}
                    onValueChanged={val => widgetStore.setOrientationMax(val, "clipd")}
                    onValueCleared={() => widgetStore.resetOrientationValue("max")}
                    displayExponential={true}
                    disabled={disableOrientationMap}
                />
            </div>
        );

        let className = "catalog-settings";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        return (
            <div className={className}>
                <FormGroup className={"file-menu"} inline={true} label="File"  disabled={disabledOverlayPanel}>
                    <Select 
                        className="bp3-fill"
                        disabled={disabledOverlayPanel}
                        filterable={false}
                        items={catalogFileItems} 
                        activeItem={this.catalogFileId}
                        onItemSelect={this.handleCatalogFileChange}
                        itemRenderer={this.renderFileIdPopOver}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                    >
                        <Button text={activeFileName} rightIcon="double-caret-vertical"  disabled={disabledOverlayPanel}/>
                    </Select>
                </FormGroup>
                <FormGroup  inline={true} label="Shape"  disabled={disabledOverlayPanel}>
                    <Select 
                        className="bp3-fill"
                        disabled={disabledOverlayPanel}
                        filterable={false}
                        items={this.catalogOverlayShape} 
                        activeItem={widgetStore.catalogShape} 
                        onItemSelect={(item) => widgetStore.setCatalogShape(item)}
                        itemRenderer={this.renderShapePopOver}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                    >
                        <Button icon={this.getCatalogShape(widgetStore.catalogShape)} rightIcon="double-caret-vertical"  disabled={disabledOverlayPanel}/>
                    </Select>
                </FormGroup>
                <Tabs
                    id="catalogSettings"
                    vertical={false}
                    selectedTabId={widgetStore.settingsTabId}
                    onChange={(tabId) => this.handleSelectedTabChanged(tabId)}
                >
                    <Tab id={CatalogSettingsTabs.GLOBAL} title="Global" panel={globalPanel}/>
                    <Tab id={CatalogSettingsTabs.STYLING} title="Styling" panel={overlayPanel} disabled={disabledOverlayPanel}/>
                    <Tab id={CatalogSettingsTabs.SIZE} title="Size" panel={sizeMap} disabled={disabledOverlayPanel}/>
                    <Tab id={CatalogSettingsTabs.COLOR} title="Color" panel={colorMap} disabled={disabledOverlayPanel}/>
                    <Tab id={CatalogSettingsTabs.ORIENTATION} title="Orientation" panel={orientationMap} disabled={disabledOverlayPanel}/>
                </Tabs>
            </div>
        );
    }

    private renderAxisPopOver = (catalogName: string, itemProps: IItemRendererProps) => {
        return (
            <MenuItem
                key={catalogName}
                text={catalogName}
                onClick={itemProps.handleClick}
            />
        );
    }

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
        const pointSize = widgetStore.sizeMajor? widgetStore.pointSizebyType : widgetStore.minorPointSizebyType;

        switch (type) {
            case "size-min":
                if (isFinite(val) && val !== pointSize.min && val < pointSize.max && val >= CatalogWidgetStore.SizeMapMin) {
                    widgetStore.setSizeMin(val);
                } else {
                    ev.currentTarget.value = pointSize.min.toString();
                }
                break;
            case "size-max":
                if (isFinite(val) && val !== pointSize.max && val > pointSize.min && val <= widgetStore.maxPointSizebyType) {
                    widgetStore.setSizeMax(val);
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

    private renderFileIdPopOver = (fileId: number, itemProps: IItemRendererProps) => {
        const fileName = this.catalogFileNames.get(fileId);
        let text = `${fileId}: ${fileName}`;
        return (
            <MenuItem
                key={fileId}
                text={text}
                onClick={itemProps.handleClick}
                active={itemProps.modifiers.active}
            />
        );
    }

    private renderShapePopOver = (shape: CatalogOverlayShape, itemProps: IItemRendererProps) => {
        const shapeItem = this.getCatalogShape(shape);
        return (
            <MenuItem
                icon={shapeItem}
                key={shape}
                onClick={itemProps.handleClick}
                active={itemProps.modifiers.active}
            />
        );
    }

    private handleSelectedTabChanged = (newTabId: React.ReactText) => {
        this.widgetStore.setSettingsTabId(Number.parseInt(newTabId.toString()));
    }

    private handleSelectedAxisTabChanged = (newTabId: React.ReactText) => {
        this.widgetStore.setSizeAxisTab(Number.parseInt(newTabId.toString()));
    }

    private getCatalogShape = (shape: CatalogOverlayShape) => {
        const widgetStore = this.widgetStore;
        let color = widgetStore.catalogColor;
        switch (shape) {
            case CatalogOverlayShape.CircleLined:
                return <Icon icon="circle" color={color}/>;
            case CatalogOverlayShape.CircleFilled:
                return <Icon icon="full-circle" color={color}/>;
            case CatalogOverlayShape.BoxLined:
                return <Icon icon="square" color={color}/>;
            case CatalogOverlayShape.CrossFilled:
                return <Icon icon="plus" color={color}/>;
            case CatalogOverlayShape.XFilled:
                return <Icon icon="cross" color={color}/>;
            case CatalogOverlayShape.TriangleUpLined:
                return IconWrapper(triangleUp, color, false);
            case CatalogOverlayShape.TriangleDownLined:
                return IconWrapper(triangleDown, color, false);
            case CatalogOverlayShape.RhombLined:
                return IconWrapper(rhomb, color, false);
            case CatalogOverlayShape.HexagonLined2:
                return IconWrapper(hexagon2, color, false);
            case CatalogOverlayShape.HexagonLined:
                return IconWrapper(hexagon, color, false);
            case CatalogOverlayShape.EllipseLined:
                return IconWrapper(ellipse, color, false);
            case CatalogOverlayShape.LineSegmentFILLED:
                return <Icon icon="minus" style={{"transform": "rotate(90deg)"}} color={color}/>;
            default:
                return <Icon icon="circle" color={color}/>;
        }
    }
}