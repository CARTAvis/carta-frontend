import * as React from "react";
import {Rnd} from "react-rnd";
import {Classes, Icon, Position, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {PlaceholderComponent, PvPreviewComponent, RenderConfigComponent} from "components";
import {HelpType, ImageType} from "enums";
import {AppStore, CatalogStore, HelpStore, LayoutStore, type WidgetConfig} from "stores";

import "./FloatingWidgetComponent.scss";

class FloatingWidgetComponentProps {
    widgetConfig: WidgetConfig;
    showPinButton: boolean;
    canPopout?: boolean;
    showFloatingSettingsButton?: boolean;
    children?: any;
    zIndex?: number;
    isSelected?: boolean;
    onSelected?: () => void;
    onClosed?: () => void;
    floatingWidgets?: number;
}

@observer
export class FloatingWidgetComponent extends React.Component<FloatingWidgetComponentProps> {
    private static readonly HeaderHeight = 25;
    private static readonly RootMenuHeight = 40;
    private rnd: Rnd | null = null;

    componentDidMount() {
        this.updatePositionAndSize();
    }

    componentDidUpdate(prevProps: FloatingWidgetComponentProps) {
        const prevConfig = prevProps.widgetConfig;
        const currConfig = this.props.widgetConfig;

        if (
            prevConfig !== currConfig ||
            prevConfig.defaultX !== currConfig.defaultX ||
            prevConfig.defaultY !== currConfig.defaultY ||
            prevConfig.defaultWidth !== currConfig.defaultWidth ||
            prevConfig.defaultHeight !== currConfig.defaultHeight
        ) {
            this.updatePositionAndSize();
        }
    }

    private handlePopout = () => {
        AppStore.Instance.widgetsStore.popoutFloatingWidget(this.props.widgetConfig);
    };

    private handlePinDragStart = (e: React.DragEvent) => {
        const layoutStore = LayoutStore.Instance;
        const layoutRef = layoutStore.layoutRef;
        const widgetConfig = this.props.widgetConfig;

        if (layoutRef?.current) {
            const tabJson: any = {
                type: "tab",
                component: widgetConfig.type,
                name: widgetConfig.title || widgetConfig.type,
                id: widgetConfig.id,
                // remove the below line if we migrate plotly.js to chart.js
                ...(widgetConfig.type === "catalog-plot" && {enablePopout: false})
            };

            if (widgetConfig.type === PlaceholderComponent.WIDGET_CONFIG.type) {
                tabJson.config = {id: widgetConfig.id, label: widgetConfig.title};
            } else if (widgetConfig.type === PvPreviewComponent.WIDGET_CONFIG.type) {
                tabJson.config = {id: widgetConfig.parentId};
            } else {
                tabJson.config = {id: widgetConfig.id};
            }

            layoutRef.current.addTabWithDragAndDrop(e.nativeEvent, tabJson, node => {
                if (node) {
                    AppStore.Instance.widgetsStore.removeFloatingWidget(widgetConfig.id, true);
                }
            });
        }
    };

    private updatePositionAndSize = () => {
        const widgetConfig = this.props.widgetConfig;
        if (!this.rnd) {
            return;
        }
        this.rnd.updateSize({width: widgetConfig.defaultWidth, height: widgetConfig.defaultHeight + FloatingWidgetComponent.HeaderHeight});
        this.rnd.updatePosition({x: widgetConfig.defaultX ?? 0, y: widgetConfig.defaultY ?? 0});
    };

    private onClickHelpButton = () => {
        if (!this.rnd) {
            return;
        }
        const centerX = (this.rnd.draggable.state as any).x + this.rnd.resizable.size.width * 0.5;
        const helpStore = HelpStore.Instance;
        const toggleOrShow = (helpType: HelpType) => {
            if (helpStore.helpVisible && helpStore.type === helpType) {
                helpStore.hideHelpDrawer();
            } else {
                helpStore.showHelpDrawer(helpType, centerX);
            }
        };

        if (this.props.widgetConfig.type === RenderConfigComponent.WIDGET_CONFIG.type) {
            toggleOrShow(AppStore.Instance.activeImage?.type === ImageType.COLOR_BLENDING ? HelpType.RENDER_CONFIG_COLOR_BLENDING : HelpType.RENDER_CONFIG);
            return;
        }

        if (Array.isArray(this.props.widgetConfig.helpType)) {
            const widgetsStore = AppStore.Instance.widgetsStore;
            const widgetParentType = this.props.widgetConfig.parentType;
            const parentId = widgetsStore.floatingSettingsWidgets.get(this.props.widgetConfig.id);
            let settingsTab: number | undefined;

            if (parentId !== undefined) {
                switch (widgetParentType) {
                    case "spatial-profiler":
                        const spatialWidget = widgetsStore.spatialProfileWidgets.get(parentId);
                        settingsTab = spatialWidget?.settingsTabId;
                        break;
                    case "spectral-profiler":
                        const spectralWidget = widgetsStore.spectralProfileWidgets.get(parentId);
                        settingsTab = spectralWidget?.settingsTabId;
                        break;
                    case "catalog-overlay":
                        const catalogStore = CatalogStore.Instance;
                        const catalogFileId = catalogStore.catalogProfiles.get(parentId);
                        if (catalogFileId) {
                            const catalogWidgetStoreId = catalogStore.catalogWidgets.get(catalogFileId);
                            if (catalogWidgetStoreId) {
                                const catalogWidget = widgetsStore.catalogWidgets.get(catalogWidgetStoreId);
                                settingsTab = catalogWidget?.settingsTabId;
                            }
                        }
                        break;
                    case "stokes":
                    default:
                        const stokesWidget = widgetsStore.stokesAnalysisWidgets.get(parentId);
                        settingsTab = stokesWidget?.settingsTabId;
                        break;
                }
            }

            if (settingsTab !== undefined && this.props.widgetConfig.helpType[settingsTab]) {
                toggleOrShow(this.props.widgetConfig.helpType[settingsTab]);
            }
        } else if (this.props.widgetConfig.helpType) {
            toggleOrShow(this.props.widgetConfig.helpType);
        }
    };

    public render() {
        const headerHeight = FloatingWidgetComponent.HeaderHeight;
        const appStore = AppStore.Instance;
        const className = classNames("floating-widget", {[Classes.DARK]: appStore.darkTheme});
        const titleClass = classNames("floating-header", {selected: this.props.isSelected, [Classes.DARK]: appStore.darkTheme});
        const buttonClass = classNames("floating-header-button", {[Classes.DARK]: appStore.darkTheme});
        const floatingContentClassName = classNames("floating-content", {[Classes.DARK]: appStore.darkTheme, "floating-settings-content": !this.props.showPinButton});

        const widgetConfig = this.props.widgetConfig;

        return (
            <Rnd
                ref={c => (this.rnd = c)}
                className={className}
                style={{zIndex: this.props.zIndex}}
                default={{
                    x: widgetConfig.defaultX ?? 0,
                    y: widgetConfig.defaultY ?? 0,
                    width: widgetConfig.defaultWidth,
                    height: widgetConfig.defaultHeight + headerHeight
                }}
                resizeGrid={[25, 25]}
                dragGrid={[25, 25]}
                minWidth={widgetConfig.minWidth}
                minHeight={widgetConfig.minHeight + headerHeight}
                bounds={".layout-container"}
                dragHandleClassName={"floating-title"}
                onMouseDown={this.props.onSelected}
                onDragStop={(e, data) => {
                    widgetConfig.setDefaultPosition(data.lastX, data.lastY);
                }}
                onResizeStop={(e, direction, element, delta, position) => {
                    const absPosition = {x: position.x, y: position.y + FloatingWidgetComponent.RootMenuHeight};
                    widgetConfig.setDefaultPosition(absPosition.x, absPosition.y);
                    widgetConfig.setDefaultSize(widgetConfig.defaultWidth + delta.width, widgetConfig.defaultHeight + delta.height);
                }}
            >
                <div className={titleClass}>
                    <div className={"floating-title"} data-testid={this.props.widgetConfig?.id + "-header-title"}>
                        {widgetConfig.title}
                    </div>
                    {this.props.showFloatingSettingsButton && (
                        <div
                            className={buttonClass}
                            onClick={() => appStore.widgetsStore.createFloatingSettingsWidget(widgetConfig.title ?? "", widgetConfig.id ?? "", widgetConfig.type)}
                            data-testid={this.props.widgetConfig?.id + "-header-settings-button"}
                        >
                            <Tooltip content="Settings" position={Position.BOTTOM_RIGHT}>
                                <span>
                                    <Icon icon={"cog"} />
                                </span>
                            </Tooltip>
                        </div>
                    )}
                    {widgetConfig.helpType && (
                        <div className={buttonClass} onClick={this.onClickHelpButton}>
                            <Tooltip content="Help" position={Position.BOTTOM_RIGHT}>
                                <span>
                                    <Icon icon={"help"} />
                                </span>
                            </Tooltip>
                        </div>
                    )}
                    {this.props.showPinButton && this.props.canPopout && (
                        <div className={buttonClass} onClick={this.handlePopout}>
                            <Tooltip content="Pop out to new window" position={Position.BOTTOM_RIGHT}>
                                <svg xmlns="http://www.w3.org/2000/svg" style={{width: "16px", height: "16px", alignItems: "center"}} viewBox="0 0 18 16" fill="currentColor">
                                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                </svg>
                            </Tooltip>
                        </div>
                    )}
                    {this.props.showPinButton && (
                        <div className={buttonClass} draggable onDragStart={this.handlePinDragStart} data-testid={this.props.widgetConfig?.id + "-header-dock-button"}>
                            <Tooltip content="Drag pin to dock this widget" position={Position.BOTTOM_RIGHT}>
                                <span>
                                    <Icon icon={"pin"} />
                                </span>
                            </Tooltip>
                        </div>
                    )}
                    {widgetConfig.isCloseable && (
                        <div onMouseDown={this.props.onClosed} className={buttonClass} data-testid={this.props.widgetConfig?.id + "-header-close-button"}>
                            <Icon icon={"cross"} />
                        </div>
                    )}
                </div>
                <div className={floatingContentClassName} data-testid={this.props.widgetConfig?.id + "-content"}>
                    {this.props.children}
                </div>
            </Rnd>
        );
    }
}
