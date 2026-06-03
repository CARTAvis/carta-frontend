import * as React from "react";
import {Rnd} from "react-rnd";
import {Classes, Icon, Position, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {PlaceholderComponent, PvPreviewComponent, RenderConfigComponent} from "components";
import {HelpType, ImageType} from "enums";
import {CustomIcon} from "icons/CustomIcons";
import {canPopoutWidget} from "models/Layout/FlexLayoutModelFactory";
import {AppStore, CatalogStore, HelpStore, LayoutStore, type WidgetConfig} from "stores";

import "./FloatingWidgetComponent.scss";

class FloatingWidgetComponentProps {
    widgetConfig: WidgetConfig;
    shouldShowPinButton: boolean;
    canPopout?: boolean;
    shouldShowFloatingSettingsButton?: boolean;
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
            const canPopout = canPopoutWidget(widgetConfig.type);
            const tabJson: any = {
                type: "tab",
                component: widgetConfig.type,
                name: widgetConfig.title || widgetConfig.type,
                id: widgetConfig.id,
                enablePopout: canPopout,
                enablePopoutIcon: canPopout
            };

            if (widgetConfig.type === PlaceholderComponent.WidgetConfig.type) {
                tabJson.config = {id: widgetConfig.id, label: widgetConfig.title};
            } else if (widgetConfig.type === PvPreviewComponent.WidgetConfig.type) {
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

    private getCatalogOverlaySettingsTab = (parentId: string): number | undefined => {
        const catalogStore = CatalogStore.Instance;
        const catalogFileId = catalogStore.catalogProfiles.get(parentId);
        if (!catalogFileId) {
            return undefined;
        }

        const catalogWidgetStoreId = catalogStore.catalogWidgets.get(catalogFileId);
        if (!catalogWidgetStoreId) {
            return undefined;
        }

        return AppStore.Instance.widgetsStore.catalogWidgets.get(catalogWidgetStoreId)?.settingsTabId;
    };

    private getSettingsTab = (parentId: string, parentType?: string): number | undefined => {
        const widgetsStore = AppStore.Instance.widgetsStore;

        switch (parentType) {
            case "spatial-profiler":
                return widgetsStore.spatialProfileWidgets.get(parentId)?.settingsTabId;
            case "spectral-profiler":
                return widgetsStore.spectralProfileWidgets.get(parentId)?.settingsTabId;
            case "catalog-overlay":
                return this.getCatalogOverlaySettingsTab(parentId);
            case "stokes":
            default:
                return widgetsStore.stokesAnalysisWidgets.get(parentId)?.settingsTabId;
        }
    };

    private getHelpType = (): HelpType | undefined => {
        const {widgetConfig} = this.props;

        if (widgetConfig.type === RenderConfigComponent.WidgetConfig.type) {
            return AppStore.Instance.activeImage?.type === ImageType.COLOR_BLENDING ? HelpType.RENDER_CONFIG_COLOR_BLENDING : HelpType.RENDER_CONFIG;
        }

        if (!Array.isArray(widgetConfig.helpType)) {
            return widgetConfig.helpType;
        }

        const parentId = AppStore.Instance.widgetsStore.floatingSettingsWidgets.get(widgetConfig.id);
        if (parentId === undefined) {
            return undefined;
        }

        const settingsTab = this.getSettingsTab(parentId, widgetConfig.parentType);
        return settingsTab === undefined ? undefined : widgetConfig.helpType[settingsTab];
    };

    private onClickHelpButton = () => {
        if (!this.rnd) {
            return;
        }
        const centerX = (this.rnd.draggable.state as any).x + this.rnd.resizable.size.width * 0.5;
        const helpStore = HelpStore.Instance;
        const helpType = this.getHelpType();
        if (!helpType) {
            return;
        }

        const toggleOrShow = (helpType: HelpType) => {
            if (helpStore.isHelpVisible && helpStore.type === helpType) {
                helpStore.hideHelpDrawer();
            } else {
                helpStore.showHelpDrawer(helpType, centerX);
            }
        };

        toggleOrShow(helpType);
    };

    public render() {
        const headerHeight = FloatingWidgetComponent.HeaderHeight;
        const appStore = AppStore.Instance;
        const className = classNames("floating-widget", {[Classes.DARK]: appStore.isDarkTheme});
        const titleClass = classNames("floating-header", {selected: this.props.isSelected, [Classes.DARK]: appStore.isDarkTheme});
        const buttonClass = classNames("floating-header-button", {[Classes.DARK]: appStore.isDarkTheme});
        const floatingContentClassName = classNames("floating-content", {[Classes.DARK]: appStore.isDarkTheme, "floating-settings-content": !this.props.shouldShowPinButton});

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
                    // manually add the height of the root-menu div to position y
                    // work-around for the change of the position definition from react-rnd v9 (absolute position) to v10 (relative position from the bounds)
                    const absPosition = {x: position.x, y: position.y + FloatingWidgetComponent.RootMenuHeight};
                    widgetConfig.setDefaultPosition(absPosition.x, absPosition.y);
                    widgetConfig.setDefaultSize(widgetConfig.defaultWidth + delta.width, widgetConfig.defaultHeight + delta.height);
                }}
            >
                <div className={titleClass}>
                    <div className={"floating-title"} data-testid={this.props.widgetConfig?.id + "-header-title"}>
                        {widgetConfig.title}
                    </div>
                    {this.props.shouldShowFloatingSettingsButton && (
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
                        <div className={buttonClass} onClick={this.onClickHelpButton} data-testid={this.props.widgetConfig?.id + "-header-help-button"}>
                            <Tooltip content="Help" position={Position.BOTTOM_RIGHT}>
                                <span>
                                    <Icon icon={"help"} />
                                </span>
                            </Tooltip>
                        </div>
                    )}
                    {this.props.shouldShowPinButton && this.props.canPopout && (
                        <div className={buttonClass} onClick={this.handlePopout}>
                            <Tooltip content="Pop out to a new window" position={Position.BOTTOM_RIGHT}>
                                <CustomIcon icon="popout" viewBox="1 1.5 16 16" />
                            </Tooltip>
                        </div>
                    )}
                    {this.props.shouldShowPinButton && (
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
