import * as React from "react";
import {Rnd} from "react-rnd";
import {Classes, Icon, Position, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import type * as GoldenLayout from "golden-layout";
import {observer} from "mobx-react";

import {PlaceholderComponent, PvPreviewComponent, RenderConfigComponent} from "components";
import {HelpType, ImageType} from "enums";
import {AppStore, CatalogStore, HelpStore, LayoutStore, type WidgetConfig} from "stores";

import "./FloatingWidgetComponent.scss";

class FloatingWidgetComponentProps {
    widgetConfig: WidgetConfig;
    showPinButton: boolean;
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
    private pinElementRef: HTMLElement | null = null;
    private rnd: Rnd | null = null;

    componentDidMount() {
        this.updateDragSource();
        this.updatePositionAndSize();
    }

    componentDidUpdate(prevProps: FloatingWidgetComponentProps) {
        this.updateDragSource();

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

    updateDragSource() {
        const layoutStore = LayoutStore.Instance;
        if (layoutStore.dockedLayout && this.pinElementRef) {
            // Check for existing drag sources
            const layout = layoutStore.dockedLayout;
            const matchingSources = layout["_dragSources"].filter(d => d._itemConfig.id === this.props.widgetConfig.id);
            const existingSource = matchingSources.find(d => d._element[0] === this.pinElementRef);
            if (existingSource) {
                return;
            }

            // Render config widget
            const itemConfig: GoldenLayout.ItemConfigType = {
                type: "react-component",
                component: this.props.widgetConfig.type,
                title: this.props.widgetConfig.title,
                id: this.props.widgetConfig.id,
                isClosable: this.props.widgetConfig.isCloseable,
                props: {id: this.props.widgetConfig.type === PvPreviewComponent.WIDGET_CONFIG.type ? this.props.widgetConfig.parentId : this.props.widgetConfig.id, docked: true}
            };

            if (this.props.widgetConfig.type === PlaceholderComponent.WIDGET_CONFIG.type) {
                itemConfig.props.label = this.props.widgetConfig.title;
            }

            if (this.pinElementRef && itemConfig) {
                layout.createDragSource(this.pinElementRef, itemConfig);
            }
        }
    }

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

        if (this.props.widgetConfig.type === RenderConfigComponent.WIDGET_CONFIG.type) {
            HelpStore.Instance.showHelpDrawer(AppStore.Instance.activeImage?.type === ImageType.COLOR_BLENDING ? HelpType.RENDER_CONFIG_COLOR_BLENDING : HelpType.RENDER_CONFIG, centerX);
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
                HelpStore.Instance.showHelpDrawer(this.props.widgetConfig.helpType[settingsTab], centerX);
            }
        } else if (this.props.widgetConfig.helpType) {
            HelpStore.Instance.showHelpDrawer(this.props.widgetConfig.helpType, centerX);
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
                bounds={".gl-container-app"}
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
                    {this.props.showFloatingSettingsButton && (
                        <div
                            className={buttonClass}
                            onClick={() => appStore.widgetsStore.createFloatingSettingsWidget(widgetConfig.title ?? "", widgetConfig.id ?? "", widgetConfig.type)}
                            data-testid={this.props.widgetConfig?.id + "-header-settings-button"}
                        >
                            <Tooltip content="Settings" position={Position.BOTTOM_RIGHT}>
                                <Icon icon={"cog"} />
                            </Tooltip>
                        </div>
                    )}
                    {widgetConfig.helpType && (
                        <div className={buttonClass} onClick={this.onClickHelpButton}>
                            <Tooltip content="Help" position={Position.BOTTOM_RIGHT}>
                                <Icon icon={"help"} />
                            </Tooltip>
                        </div>
                    )}
                    {this.props.showPinButton && (
                        <div className={buttonClass} ref={ref => (this.pinElementRef = ref)} onClick={() => console.log("pin!")} data-testid={this.props.widgetConfig?.id + "-header-dock-button"}>
                            <Tooltip content="Drag pin to dock this widget" position={Position.BOTTOM_RIGHT}>
                                <Icon icon={"pin"} />
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
