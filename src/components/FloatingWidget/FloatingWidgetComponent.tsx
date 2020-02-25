import * as React from "react";
import * as GoldenLayout from "golden-layout";
import {observer} from "mobx-react";
import {Rnd} from "react-rnd";
import {Icon, Position, Tooltip} from "@blueprintjs/core";
import {PlaceholderComponent} from "components";
import {AppStore, WidgetConfig} from "stores";
import "./FloatingWidgetComponent.css";

class FloatingWidgetComponentProps {
    widgetConfig: WidgetConfig;
    appStore: AppStore;
    showPinButton: boolean;
    showFloatingSettingsButton?: boolean;
    children?: any;
    zIndex?: number;
    isSelected?: boolean;
    onSelected?: () => void;
    onClosed?: () => void;
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
        if (this.props.appStore.layoutStore.dockedLayout && this.pinElementRef) {
            // Check for existing drag sources
            const layout = this.props.appStore.layoutStore.dockedLayout;
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
                props: {appStore: this.props.appStore, id: this.props.widgetConfig.id, docked: true}
            };

            if (this.props.widgetConfig.type === PlaceholderComponent.WIDGET_CONFIG.type) {
                itemConfig.props.label = this.props.widgetConfig.title;
            }

            if (this.pinElementRef && itemConfig) {
                layout.createDragSource(this.pinElementRef, itemConfig);
            }
        }
    }

    constructor(props: FloatingWidgetComponentProps) {
        super(props);
    }

    public render() {
        const headerHeight = 25;
        const appStore = this.props.appStore;
        const widgetsStore = appStore.widgetsStore;
        let className = "floating-widget";
        let floatingContentClassName = "floating-content";
        let titleClass = this.props.isSelected ? "floating-header selected" : "floating-header";
        let buttonClass = "floating-header-button";

        if (appStore.darkTheme) {
            className += " bp3-dark";
            titleClass += " bp3-dark";
            buttonClass += " bp3-dark";
        }

        if (!this.props.showPinButton) {
            floatingContentClassName = "floating-settings-content";
        }
        const widgetConfig = this.props.widgetConfig;
        return (
            <Rnd
                ref={c => this.rnd = c}
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
                bounds={".gl-container"}
                dragHandleClassName={"floating-title"}
                onMouseDown={this.props.onSelected}
                onDragStop={(e, data) => {
                    widgetConfig["defaultX"] = data.lastX;
                    widgetConfig["defaultY"] = data.lastY;
                }}
                onResizeStop={(e, direction, element, delta, position) => {
                    widgetConfig["defaultX"] = position.x;
                    widgetConfig["defaultY"] = position.y;
                    widgetConfig.defaultWidth += delta.width;
                    widgetConfig.defaultHeight += delta.height;
                }}
            >
                <div className={titleClass}>
                    <div className={"floating-title"}>
                        {widgetConfig.title}
                    </div>
                    {this.props.showFloatingSettingsButton &&
                    <div className={buttonClass} onClick={() => appStore.widgetsStore.createFloatingSettingsWidget(widgetConfig.title, widgetConfig.id, widgetConfig.type)}>
                        <Tooltip content="Settings" position={Position.BOTTOM_RIGHT}>
                            <Icon icon={"cog"}/>
                        </Tooltip>
                    </div>
                    }
                    {widgetConfig.helpType &&
                    <div className={buttonClass} onClick={() => appStore.helpStore.showHelpDrawer(widgetConfig.helpType)}>
                        <Tooltip content="Help" position={Position.BOTTOM_RIGHT}>
                            <Icon icon={"help"}/>
                        </Tooltip>
                    </div>
                    }
                    {this.props.showPinButton &&
                    <div className={buttonClass} ref={ref => this.pinElementRef = ref} onClick={() => console.log("pin!")}>
                        <Tooltip content="Drag pin to dock this widget" position={Position.BOTTOM_RIGHT}>
                            <Icon icon={"pin"}/>
                        </Tooltip>
                    </div>
                    }
                    {widgetConfig.isCloseable &&
                    <div onMouseDown={this.props.onClosed} className={buttonClass}>
                        <Icon icon={"cross"}/>
                    </div>
                    }
                </div>
                <div className={floatingContentClassName}>
                    {this.props.children}
                </div>
            </Rnd>
        );
    }
}