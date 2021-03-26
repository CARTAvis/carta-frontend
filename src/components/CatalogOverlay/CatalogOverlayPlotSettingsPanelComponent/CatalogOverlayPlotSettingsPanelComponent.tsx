import {observer} from "mobx-react";
import {action, autorun, computed, makeObservable} from "mobx";
import * as React from "react";
import {Button, FormGroup, Icon, MenuItem, PopoverPosition, Tab, Tabs} from "@blueprintjs/core";
import {Select, IItemRendererProps} from "@blueprintjs/select";
import {AppStore, CatalogStore, DefaultWidgetConfig, HelpType, PreferenceStore, PreferenceKeys, WidgetProps, WidgetsStore} from "stores";
import {CatalogOverlayShape, CatalogWidgetStore, CatalogSettingsTabs} from "stores/widgets";
import {ColorResult} from "react-color";
import {ColorPickerComponent, SafeNumericInput} from "components/Shared";
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
const ellipse = <ellipse cx="8" cy="8" rx="7" ry="4"/>;

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
        CatalogOverlayShape.XFilled
    ];

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "catalog-overlay-floating-settings",
            type: "floating-settings",
            minWidth: 350,
            minHeight: 225,
            defaultWidth: 375,
            defaultHeight: 375,
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
            default:
                return <Icon icon="circle" color={color}/>;
        }
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
                <FormGroup  inline={true} label="Size" labelInfo="(px)"  disabled={disabledOverlayPanel}>
                    <SafeNumericInput
                        placeholder="Catalog Size"
                        disabled={disabledOverlayPanel}
                        min={CatalogWidgetStore.MinOverlaySize}
                        max={CatalogWidgetStore.MaxOverlaySize}
                        value={widgetStore.catalogSize}
                        stepSize={1}
                        onValueChange={(value: number) => widgetStore.setCatalogSize(value)}
                    />
                </FormGroup>
            </div>
        );

        let className = "catalog-settings";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        return (
            <div className={className}>
                <Tabs
                    id="catalogSettings"
                    vertical={false}
                    selectedTabId={widgetStore.settingsTabId}
                    onChange={(tabId) => this.handleSelectedTabChanged(tabId)}
                >
                    <Tab id={CatalogSettingsTabs.GLOBAL} title="Global" panel={globalPanel}/>
                    <Tab id={CatalogSettingsTabs.IMAGE_OVERLAY} title="Image Overlay" panel={overlayPanel} disabled={disabledOverlayPanel}/>
                </Tabs>
            </div>
        );
    }
}