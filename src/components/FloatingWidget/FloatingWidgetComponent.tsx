import * as React from "react";
import {Rnd} from "react-rnd";
import {Icon, Position} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import classNames from "classnames";
import * as GoldenLayout from "golden-layout";
import {observer} from "mobx-react";

import {PlaceholderComponent} from "components";
import {AppStore, CatalogStore, HelpStore, LayoutStore, WidgetConfig} from "stores";

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
    private pinElementRef: HTMLElement;
    private rnd: Rnd;

    componentDidMount() {
        this.updateDragSource();
        this.rnd.updateSize({width: this.props.widgetConfig.defaultWidth, height: this.props.widgetConfig.defaultHeight});
        this.rnd.updatePosition({x: this.props.widgetConfig.defaultX, y: this.props.widgetConfig.defaultY});
    }

    componentDidUpdate() {
        this.updateDragSource();
        this.rnd.updateSize({width: this.props.widgetConfig.defaultWidth, height: this.props.widgetConfig.defaultHeight});
        this.rnd.updatePosition({x: this.props.widgetConfig.defaultX, y: this.props.widgetConfig.defaultY});
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
            let itemConfig: GoldenLayout.ItemConfigType;

            itemConfig = {
                type: "react-component",
                component: this.props.widgetConfig.type,
                title: this.props.widgetConfig.title,
                id: this.props.widgetConfig.id,
                isClosable: this.props.widgetConfig.isCloseable,
                props: {id: this.props.widgetConfig.id, docked: true}
            };

            if (this.props.widgetConfig.type === PlaceholderComponent.WIDGET_CONFIG.type) {
                itemConfig.props.label = this.props.widgetConfig.title;
            }

            if (this.pinElementRef && itemConfig) {
                layout.createDragSource(this.pinElementRef, itemConfig);
            }
        }
    }

    private onClickHelpButton = () => {
        const centerX = this.rnd.draggable.state.x + this.rnd.resizable.size.width * 0.5;
        if (Array.isArray(this.props.widgetConfig.helpType)) {
            const widgetsStore = AppStore.Instance.widgetsStore;
            const widgetParentType = this.props.widgetConfig.parentType;
            const parentId = widgetsStore.floatingSettingsWidgets.get(this.props.widgetConfig.id);
            let settingsTab: number;
            switch (widgetParentType) {
                case "spatial-profiler":
                    settingsTab = widgetsStore.spatialProfileWidgets.get(parentId).settingsTabId;
                    break;
                case "spectral-profiler":
                    settingsTab = widgetsStore.spectralProfileWidgets.get(parentId).settingsTabId;
                    break;
                case "catalog-overlay":
                    const catalogStore = CatalogStore.Instance;
                    const catalogFileId = catalogStore.catalogProfiles.get(parentId);
                    if (catalogFileId) {
                        const catalogWidgetStoreId = catalogStore.catalogWidgets.get(catalogFileId);
                        settingsTab = widgetsStore.catalogWidgets.get(catalogWidgetStoreId).settingsTabId;
                    }
                    break;
                case "stokes":
                default:
                    settingsTab = widgetsStore.stokesAnalysisWidgets.get(parentId).settingsTabId;
                    break;
            }
            HelpStore.Instance.showHelpDrawer(this.props.widgetConfig.helpType[settingsTab], centerX);
        } else {
            HelpStore.Instance.showHelpDrawer(this.props.widgetConfig.helpType, centerX);
        }
    };

    public render() {
        const headerHeight = 25;
        const appStore = AppStore.Instance;
        const className = classNames("floating-widget", {"bp4-dark": appStore.darkTheme});
        const titleClass = classNames("floating-header", {selected: this.props.isSelected, "bp4-dark": appStore.darkTheme});
        const buttonClass = classNames("floating-header-button", {"bp4-dark": appStore.darkTheme});
        const floatingContentClassName = classNames("floating-content", {"bp4-dark": appStore.darkTheme, "floating-settings-content": !this.props.showPinButton});

        const widgetConfig = this.props.widgetConfig;

        return (
            <Rnd
                ref={c => (this.rnd = c)}
                className={className}
                style={{zIndex: this.props.zIndex}}
                default={{
                    x: widgetConfig.defaultX,
                    y: widgetConfig.defaultY,
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
                    widgetConfig.setDefaultPosition(position.x, position.y);
                    widgetConfig.setDefaultSize(widgetConfig.defaultWidth + delta.width, widgetConfig.defaultHeight + delta.height);
                }}
            >
                <div className={titleClass}>
                    <div className={"floating-title"}>{widgetConfig.title}</div>
                    {this.props.showFloatingSettingsButton && (
                        <div className={buttonClass} onClick={() => appStore.widgetsStore.createFloatingSettingsWidget(widgetConfig.title, widgetConfig.id, widgetConfig.type)}>
                            <Tooltip2 content="Settings" position={Position.BOTTOM_RIGHT}>
                                <Icon icon={"cog"} />
                            </Tooltip2>
                        </div>
                    )}
                    {widgetConfig.helpType && (
                        <div className={buttonClass} onClick={this.onClickHelpButton}>
                            <Tooltip2 content="Help" position={Position.BOTTOM_RIGHT}>
                                <Icon icon={"help"} />
                            </Tooltip2>
                        </div>
                    )}
                    {this.props.showPinButton && (
                        <div className={buttonClass} ref={ref => (this.pinElementRef = ref)} onClick={() => console.log("pin!")}>
                            <Tooltip2 content="Drag pin to dock this widget" position={Position.BOTTOM_RIGHT}>
                                <Icon icon={"pin"} />
                            </Tooltip2>
                        </div>
                    )}
                    {widgetConfig.isCloseable && (
                        <div onMouseDown={this.props.onClosed} className={buttonClass}>
                            <Icon icon={"cross"} />
                        </div>
                    )}
                </div>
                <div className={floatingContentClassName}>{this.props.children}</div>
            </Rnd>
        );
    }
}
