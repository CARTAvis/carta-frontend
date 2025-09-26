import * as React from "react";
import {Rnd} from "react-rnd";
import {Classes, Icon, Position, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import * as FlexLayout from "flexlayout-react";
import {observer} from "mobx-react";

import {PvPreviewComponent, RenderConfigComponent} from "components";
import {HelpType, ImageType} from "enums";
import {AppStore, CatalogStore, FlexLayoutStore, HelpStore, WidgetConfig} from "stores";

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
    private pinElementRef: HTMLElement | null = null;
    private rnd: Rnd | null = null;
    private isDragging: boolean = false;
    private dragStartPosition: {x: number, y: number} | null = null;

    componentDidMount() {
        if (this.rnd) {
            this.rnd.updateSize({width: this.props.widgetConfig.defaultWidth, height: this.props.widgetConfig.defaultHeight});
            this.rnd.updatePosition({
                x: this.props.widgetConfig.defaultX ?? 0,
                y: this.props.widgetConfig.defaultY ?? 0
            });
        }
    }

    componentDidUpdate() {
        if (this.rnd) {
            this.rnd.updateSize({width: this.props.widgetConfig.defaultWidth, height: this.props.widgetConfig.defaultHeight});
            this.rnd.updatePosition({
                x: this.props.widgetConfig.defaultX ?? 0,
                y: this.props.widgetConfig.defaultY ?? 0
            });
        }
    }

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

            if (parentId) {
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

    private findTabsetUnderPoint = (x: number, y: number): string | null => {
        const flexLayoutStore = FlexLayoutStore.Instance;
        if (!flexLayoutStore.model) return null;

        // Get element at point to find the closest tabset
        const elementAtPoint = document.elementFromPoint(x, y);
        if (!elementAtPoint) return null;

        // Find the closest tabset element
        const tabsetElement = elementAtPoint.closest('.flexlayout__tabset');
        if (!tabsetElement) return null;

        // Get all tabsets from the model and match by index
        // This is a simplified approach - in production, you might want to add
        // data attributes to DOM elements to match them with model nodes
        const root = flexLayoutStore.model.getRoot();
        const tabsets: FlexLayout.TabSetNode[] = [];
        
        const visitNode = (node: FlexLayout.Node) => {
            if (node.getType() === "tabset") {
                tabsets.push(node as FlexLayout.TabSetNode);
            }
            const children = node.getChildren();
            if (children) {
                for (const child of children) {
                    visitNode(child);
                }
            }
        };
        
        visitNode(root);

        // Find the index of the tabset element in the DOM
        const allTabsetElements = document.querySelectorAll('.flexlayout__tabset');
        const tabsetIndex = Array.from(allTabsetElements).indexOf(tabsetElement as Element);
        
        // Return the corresponding tabset ID from the model
        if (tabsetIndex >= 0 && tabsetIndex < tabsets.length) {
            return tabsets[tabsetIndex].getId();
        }
        
        // Fallback: return the first tabset if we can't match exactly
        return tabsets.length > 0 ? tabsets[0].getId() : null;
    };

    private pinToTabset = (targetTabsetId: string | null = null) => {
        const flexLayoutStore = FlexLayoutStore.Instance;
        if (flexLayoutStore.model && this.props.widgetConfig) {
            // Create a new tab in the FlexLayout model
            const tabConfig = {
                type: "tab",
                component: this.props.widgetConfig.type,
                name: this.props.widgetConfig.title,
                id: this.props.widgetConfig.id,
                config: {
                    id: this.props.widgetConfig.type === PvPreviewComponent.WIDGET_CONFIG.type ? this.props.widgetConfig.parentId : this.props.widgetConfig.id,
                    docked: true
                }
            };

            // Use provided tabset or find the best one
            let finalTargetTabsetId = targetTabsetId || "TABSET_1"; // Default fallback
            
            if (!targetTabsetId) {
                try {
                    // Try to find an active tabset or the first available tabset
                    const root = flexLayoutStore.model.getRoot();
                    const tabsets: FlexLayout.TabSetNode[] = [];
                    
                    // Collect all tabsets
                    const visitNode = (node: FlexLayout.Node) => {
                        if (node.getType() === "tabset") {
                            tabsets.push(node as FlexLayout.TabSetNode);
                        }
                        const children = node.getChildren();
                        if (children) {
                            for (const child of children) {
                                visitNode(child);
                            }
                        }
                    };
                    
                    visitNode(root);
                    
                    // Prefer active tabset, otherwise use the first one found
                    const activeTabset = tabsets.find(tabset => {
                        const selectedNode = tabset.getSelectedNode();
                        return selectedNode !== null;
                    });
                    
                    if (activeTabset) {
                        finalTargetTabsetId = activeTabset.getId();
                    } else if (tabsets.length > 0) {
                        finalTargetTabsetId = tabsets[0].getId();
                    }
                    
                } catch (error) {
                    console.warn("Could not find optimal tabset for pinning, using default:", error);
                }
            }

            // Add the tab to the target tabset
            const action = FlexLayout.Actions.addNode(tabConfig, finalTargetTabsetId, FlexLayout.DockLocation.CENTER, -1);
            flexLayoutStore.model.doAction(action);

            // Close the floating widget
            if (this.props.onClosed) {
                this.props.onClosed();
            }
        }
    };

    private onPinButtonClick = () => {
        this.pinToTabset();
    };

    public render() {
        const headerHeight = 25;
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
                bounds={".flex-layout-container"}
                dragHandleClassName={"floating-title"}
                onMouseDown={this.props.onSelected}
                onDragStart={(e, data) => {
                    this.isDragging = true;
                    this.dragStartPosition = {x: data.x, y: data.y};
                    console.log("Drag started at:", data.x, data.y);
                    
                    // Add visual feedback for drag-to-dock
                    document.body.classList.add('floating-widget-dragging');
                    
                    // Highlight potential drop zones
                    const tabsets = document.querySelectorAll('.flexlayout__tabset');
                    tabsets.forEach(tabset => {
                        tabset.classList.add('potential-drop-zone');
                    });
                }}
                onDrag={(e, data) => {
                    if (!this.isDragging) return;
                    
                    // Check if we're over a tabset
                    const centerX = data.x + (this.rnd?.resizable.size.width || 0) / 2;
                    const centerY = data.y + 10;
                    const tabsetId = this.findTabsetUnderPoint(centerX, centerY);
                    
                    // Update drop zone highlighting
                    const tabsets = document.querySelectorAll('.flexlayout__tabset');
                    tabsets.forEach((tabset, index) => {
                        tabset.classList.remove('active-drop-zone');
                        
                        // If this is the tabset under cursor, highlight it
                        if (tabsetId) {
                            const elementAtPoint = document.elementFromPoint(centerX, centerY);
                            const targetTabset = elementAtPoint?.closest('.flexlayout__tabset');
                            if (targetTabset === tabset) {
                                tabset.classList.add('active-drop-zone');
                            }
                        }
                    });
                }}
                onDragStop={(e, data) => {
                    this.isDragging = false;
                    
                    // Remove visual feedback
                    document.body.classList.remove('floating-widget-dragging');
                    const tabsets = document.querySelectorAll('.flexlayout__tabset');
                    tabsets.forEach(tabset => {
                        tabset.classList.remove('potential-drop-zone', 'active-drop-zone');
                    });
                    
                    // Check if we should dock to a tabset
                    const centerX = data.x + (this.rnd?.resizable.size.width || 0) / 2;
                    const centerY = data.y + 10; // Use top of widget for drop detection
                    const targetTabsetId = this.findTabsetUnderPoint(centerX, centerY);
                    
                    if (targetTabsetId && this.dragStartPosition) {
                        // Calculate drag distance to determine if this was intentional docking
                        const dragDistance = Math.sqrt(
                            Math.pow(data.x - this.dragStartPosition.x, 2) + 
                            Math.pow(data.y - this.dragStartPosition.y, 2)
                        );
                        
                        // Only dock if dragged a meaningful distance (> 50px) to avoid accidental docking
                        if (dragDistance > 50) {
                            console.log("Docking to tabset:", targetTabsetId);
                            this.pinToTabset(targetTabsetId);
                            return; // Don't update position if we're docking
                        }
                    }
                    
                    // Normal drag behavior - update position
                    widgetConfig.setDefaultPosition(data.lastX, data.lastY);
                    this.dragStartPosition = null;
                }}
                onResizeStop={(e, direction, element, delta, position) => {
                    // manually add the height of the root-menu div to position y
                    // work-around for the change of the position definition from react-rnd v9 (absolute position) to v10 (relative position from the bounds)
                    const rootMenuHeight = 40;
                    const absPosition = {x: position.x, y: position.y + rootMenuHeight};
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
                        <div className={buttonClass} ref={ref => (this.pinElementRef = ref)} onClick={this.onPinButtonClick} data-testid={this.props.widgetConfig?.id + "-header-dock-button"}>
                            <Tooltip content="Click to dock this widget to the layout" position={Position.BOTTOM_RIGHT}>
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
