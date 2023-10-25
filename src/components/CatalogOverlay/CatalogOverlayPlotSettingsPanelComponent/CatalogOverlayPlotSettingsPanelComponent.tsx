import * as React from "react";
import {AnchorButton, Button, ButtonGroup, FormGroup, Icon, MenuItem, PopoverPosition, Switch, Tab, Tabs} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {IItemRendererProps, ItemPredicate, Select} from "@blueprintjs/select";
import classNames from "classnames";
import FuzzySearch from "fuzzy-search";
import {action, autorun, computed, makeObservable} from "mobx";
import {observer} from "mobx-react";

import {CatalogOverlayComponent} from "components";
import {AutoColorPickerComponent, ClearableNumericInputComponent, ColormapComponent, SafeNumericInput, ScalingSelectComponent} from "components/Shared";
import {CatalogOverlay} from "models";
import {AppStore, CatalogOnlineQueryProfileStore, CatalogProfileStore, CatalogStore, DefaultWidgetConfig, HelpType, WidgetProps, WidgetsStore} from "stores";
import {CatalogOverlayShape, CatalogSettingsTabs, CatalogWidgetStore, ValueClip} from "stores/Widgets";
import {getColorForTheme, SWATCH_COLORS} from "utilities";

import "./CatalogOverlayPlotSettingsPanelComponent.scss";

const IconWrapper = (path: React.SVGProps<SVGPathElement>, color: string, fill: boolean, strokeWidth = 2, viewboxDefault = 16) => {
    let fillColor = color;
    if (!fill) {
        fillColor = "none";
    }
    return (
        <span className="bp3-icon">
            <svg data-icon="triangle-up-open" width="16" height="16" viewBox={`0 0 ${viewboxDefault} ${viewboxDefault}`} style={{stroke: color, fill: fillColor, strokeWidth: strokeWidth}}>
                {path}
            </svg>
        </span>
    );
};

const triangleUp = <path d="M 2 14 L 14 14 L 8 3 Z" />;
const triangleDown = <path d="M 2 2 L 14 2 L 8 13 Z" />;
const rhomb = <path d="M 8 14 L 14 8 L 8 2 L 2 8 Z" />;
const hexagon2 = <path d="M 12.33 5.5 L 12.33 10.5 L 8 13 L 3.67 10.5 L 3.67 5.5 L 8 3 Z" />;
const hexagon = <path d="M 3 8 L 5.5 3.67 L 10.5 3.67 L 13 8 L 10.5 12.33 L 5.5 12.33 Z" />;
const ellipse = <ellipse cx="8" cy="8" rx="4" ry="7" />;
const KEYCODE_ENTER = 13;

@observer
export class CatalogOverlayPlotSettingsPanelComponent extends React.Component<WidgetProps> {
    private catalogFileNames: Map<number, string>;
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
            minWidth: 350,
            minHeight: 250,
            defaultWidth: 350,
            defaultHeight: 560,
            title: "catalog-overlay-settings",
            isCloseable: true,
            parentId: "catalog-overlay",
            parentType: "catalog-overlay",
            helpType: [HelpType.CATALOG_SETTINGS_GOLBAL, HelpType.CATALOG_SETTINGS_OVERLAY, HelpType.CATALOG_SETTINGS_COLOR, HelpType.CATALOG_SETTINGS_SIZE, HelpType.CATALOG_SETTINGS_ORIENTATION]
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

    @computed get profileStore(): CatalogProfileStore | CatalogOnlineQueryProfileStore {
        return CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
    }

    @computed get axisOption() {
        const profileStore = this.profileStore;
        let axisOptions = [];
        axisOptions.push(CatalogOverlay.NONE);
        profileStore?.catalogControlHeader?.forEach((header, columnName) => {
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
    };

    public render() {
        const appStore = AppStore.Instance;
        const widgetStore = this.widgetStore;
        const catalogStore = CatalogStore.Instance;
        const catalogFileIds = catalogStore.activeCatalogFiles;

        let catalogFileItems = [];
        catalogFileIds.forEach(value => {
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
                        <Button text={widgetStore.sizeMapColumn} disabled={disabledOverlayPanel} rightIcon="double-caret-vertical" />
                    </Select>
                </FormGroup>
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
                        value={widgetStore.sizeColumnMin.clipd}
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
                        value={widgetStore.sizeColumnMax.clipd}
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
                        value={widgetStore.sizeMinorColumnMin.clipd}
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
                        value={widgetStore.sizeMinorColumnMax.clipd}
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
            </div>
        );

        const sizeMap = (
            <div className="panel-container">
                <FormGroup inline={true} label="Size" labelInfo="(px)" disabled={disabledOverlayPanel}>
                    <Tooltip2 disabled={disabledOverlayPanel || !widgetStore.disableSizeMap} content={`${CatalogWidgetStore.MinOverlaySize} ~ ${CatalogWidgetStore.MaxOverlaySize}`}>
                        <SafeNumericInput
                            placeholder="Size"
                            disabled={disabledOverlayPanel || !widgetStore.disableSizeMap}
                            min={CatalogWidgetStore.MinOverlaySize}
                            max={CatalogWidgetStore.MaxOverlaySize}
                            clampValueOnBlur={true}
                            value={widgetStore.catalogSize}
                            stepSize={0.5}
                            onValueChange={(value: number) => widgetStore.setCatalogSize(value)}
                        />
                    </Tooltip2>
                </FormGroup>
                <FormGroup inline={true} label="Thickness" disabled={disabledOverlayPanel}>
                    <Tooltip2 disabled={disabledOverlayPanel} content={`${CatalogWidgetStore.MinThickness} ~ ${CatalogWidgetStore.MaxThickness}`}>
                        <SafeNumericInput
                            placeholder="Thickness"
                            disabled={disabledOverlayPanel}
                            min={CatalogWidgetStore.MinThickness}
                            max={CatalogWidgetStore.MaxThickness}
                            clampValueOnBlur={true}
                            value={widgetStore.thickness}
                            stepSize={0.5}
                            onValueChange={(value: number) => widgetStore.setThickness(value)}
                        />
                    </Tooltip2>
                </FormGroup>
                <Tabs id="catalogSettings" vertical={false} selectedTabId={widgetStore.sizeAxisTabId} onChange={tabId => this.handleSelectedAxisTabChanged(tabId)}>
                    <Tab id={CatalogSettingsTabs.SIZE_MAJOR} title="Major" panel={sizeMajor} />
                    <Tab id={CatalogSettingsTabs.SIZE_MINOR} title="Minor" panel={sizeMinor} disabled={!widgetStore.enableSizeMinorTab} />
                </Tabs>
                <FormGroup inline={true} label="Size min" labelInfo="(px)" disabled={disableSizeMap}>
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
                </FormGroup>
                <FormGroup inline={true} label="Size max" labelInfo="(px)" disabled={disableSizeMap}>
                    <Tooltip2 content={`Maximum size ${widgetStore.maxPointSizebyType}`}>
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
                    </Tooltip2>
                </FormGroup>
            </div>
        );

        const colorMap = (
            <div className="panel-container">
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
                        <Button text={widgetStore.colorMapColumn} disabled={disabledOverlayPanel} rightIcon="double-caret-vertical" />
                    </Select>
                </FormGroup>
                <FormGroup label={"Scaling"} inline={true} disabled={disableColorMap}>
                    <ScalingSelectComponent selectedItem={widgetStore.colorScalingType} onItemSelect={type => widgetStore.setColorScalingType(type)} disabled={disableColorMap} />
                </FormGroup>
                <FormGroup inline={true} label="Colormap" disabled={disableColorMap}>
                    <ColormapComponent inverted={false} selectedItem={widgetStore.colorMap} onItemSelect={selected => widgetStore.setColorMap(selected)} disabled={disableColorMap} />
                </FormGroup>
                <FormGroup label={"Invert colormap"} inline={true} disabled={disableColorMap}>
                    <Switch checked={widgetStore.invertedColorMap} onChange={ev => widgetStore.setColorMapDirection(ev.currentTarget.checked)} disabled={disableColorMap} />
                </FormGroup>
                <ClearableNumericInputComponent
                    label="Clip min"
                    max={widgetStore.colorColumnMax.clipd}
                    integerOnly={false}
                    value={widgetStore.colorColumnMin.clipd}
                    onValueChanged={val => widgetStore.setColorColumnMin(val, "clipd")}
                    onValueCleared={() => widgetStore.resetColorColumnValue("min")}
                    displayExponential={true}
                    disabled={disableColorMap}
                />
                <ClearableNumericInputComponent
                    label="Clip max"
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
                        onItemSelect={columnName => widgetStore.setOrientationMapColumn(columnName)}
                        itemRenderer={this.renderAxisPopOver}
                        disabled={disabledOverlayPanel}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        filterable={true}
                        noResults={noResults}
                        itemPredicate={this.filterColumn}
                        resetOnSelect={true}
                    >
                        <Button text={widgetStore.orientationMapColumn} disabled={disabledOverlayPanel} rightIcon="double-caret-vertical" />
                    </Select>
                </FormGroup>
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
                    value={widgetStore.orientationMin.clipd}
                    onValueChanged={val => widgetStore.setOrientationMin(val, "clipd")}
                    onValueCleared={() => widgetStore.resetOrientationValue("min")}
                    displayExponential={true}
                    disabled={disableOrientationMap}
                />
                <ClearableNumericInputComponent
                    label="Clip max"
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
        const className = classNames("catalog-settings", {"bp3-dark": appStore.darkTheme});

        return (
            <div className={className}>
                <FormGroup className={"file-menu"} inline={true} label="File" disabled={disabledOverlayPanel}>
                    <Select
                        className="bp3-fill"
                        disabled={disabledOverlayPanel}
                        filterable={false}
                        items={catalogFileItems}
                        activeItem={this.catalogFileId}
                        onItemSelect={this.handleCatalogFileChange}
                        itemRenderer={this.renderFileIdPopOver}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                    >
                        <Button text={activeFileName} rightIcon="double-caret-vertical" disabled={disabledOverlayPanel} />
                    </Select>
                </FormGroup>
                <FormGroup className={"file-menu"} inline={true} label="Shape" disabled={disabledOverlayPanel}>
                    <Select
                        className="bp3-fill"
                        disabled={disabledOverlayPanel}
                        filterable={false}
                        items={this.catalogOverlayShape}
                        activeItem={widgetStore.catalogShape}
                        onItemSelect={item => widgetStore.setCatalogShape(item)}
                        itemRenderer={this.renderShapePopOver}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                    >
                        <Button icon={this.getCatalogShape(widgetStore.catalogShape)} rightIcon="double-caret-vertical" disabled={disabledOverlayPanel} />
                    </Select>
                </FormGroup>
                <Tabs id="catalogSettings" vertical={false} selectedTabId={widgetStore.settingsTabId} onChange={tabId => this.handleSelectedTabChanged(tabId)}>
                    <Tab id={CatalogSettingsTabs.SIZE} title="Size" panel={sizeMap} disabled={disabledOverlayPanel} />
                    <Tab id={CatalogSettingsTabs.COLOR} title="Color" panel={colorMap} disabled={disabledOverlayPanel} />
                    <Tab id={CatalogSettingsTabs.ORIENTATION} title="Orientation" panel={orientationMap} disabled={disabledOverlayPanel} />
                </Tabs>
            </div>
        );
    }

    private renderAxisPopOver = (catalogName: string, itemProps: IItemRendererProps) => {
        return <MenuItem key={catalogName} text={catalogName} onClick={itemProps.handleClick} />;
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
        const pointSize = widgetStore.sizeMajor ? widgetStore.pointSizebyType : widgetStore.minorPointSizebyType;

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
        return <MenuItem key={fileId} text={text} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
    };

    private renderShapePopOver = (shape: CatalogOverlayShape, itemProps: IItemRendererProps) => {
        const shapeItem = this.getCatalogShape(shape);
        return <MenuItem icon={shapeItem} key={shape} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
    };

    private handleSelectedTabChanged = (newTabId: React.ReactText) => {
        this.widgetStore.setSettingsTabId(Number.parseInt(newTabId.toString()));
    };

    private handleSelectedAxisTabChanged = (newTabId: React.ReactText) => {
        this.widgetStore.setSizeAxisTab(Number.parseInt(newTabId.toString()));
    };

    private getCatalogShape = (shape: CatalogOverlayShape) => {
        const widgetStore = this.widgetStore;
        let color = widgetStore.catalogColor;
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
                return IconWrapper(triangleUp, color, false);
            case CatalogOverlayShape.TRIANGLE_LINED_DOWN:
                return IconWrapper(triangleDown, color, false);
            case CatalogOverlayShape.RHOMB_LINED:
                return IconWrapper(rhomb, color, false);
            case CatalogOverlayShape.HEXAGON_LINED_2:
                return IconWrapper(hexagon2, color, false);
            case CatalogOverlayShape.HEXAGON_LINED:
                return IconWrapper(hexagon, color, false);
            case CatalogOverlayShape.ELLIPSE_LINED:
                return IconWrapper(ellipse, color, false);
            case CatalogOverlayShape.LineSegment_FILLED:
                return <Icon icon="minus" style={{transform: "rotate(90deg)"}} color={color} />;
            default:
                return <Icon icon="circle" color={color} />;
        }
    };
}
