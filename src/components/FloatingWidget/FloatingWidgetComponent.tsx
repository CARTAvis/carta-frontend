import * as React from "react";
import "./FloatingWidgetComponent.css";
import {Rnd} from "react-rnd";
import {Icon} from "@blueprintjs/core";
import * as GoldenLayout from "golden-layout";
import {AppStore} from "../../stores/AppStore";
import {WidgetConfig} from "../../stores/FloatingWidgetStore";
import {PlaceholderComponent} from "../Placeholder/PlaceholderComponent";
import {observer} from "mobx-react";

class FloatingWidgetComponentProps {
    layout: GoldenLayout;
    widgetConfig: WidgetConfig;
    appStore: AppStore;
    showPinButton: boolean;
    children?: any;
    zIndex?: number;
    isSelected?: boolean;
    onSelected?: () => void;
    onClosed?: () => void;
}

@observer
export class FloatingWidgetComponent extends React.Component<FloatingWidgetComponentProps> {

    private pinElementRef: HTMLElement;
    private createdDragSources = false;

    componentDidUpdate() {
        if (this.createdDragSources) {
            return;
        }

        if (this.props.layout && !this.createdDragSources) {
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
                this.props.layout.createDragSource(this.pinElementRef, itemConfig);
            }

            this.createdDragSources = true;
        }
    }

    constructor(props: FloatingWidgetComponentProps) {
        super(props);
    }

    public render() {
        const headerHeight = 25;
        const titleClass = this.props.isSelected ? "floating-header selected" : "floating-header";
        const widgetConfig = this.props.widgetConfig;
        return (
            <Rnd
                className="floating-widget"
                style={{zIndex: this.props.zIndex}}
                default={{
                    // Shift by 5 pixels to compensate for 5px CSS margins
                    x: widgetConfig.defaultX !== undefined ? widgetConfig.defaultX : this.props.appStore.floatingWidgetStore.defaultOffset + 5,
                    y: widgetConfig.defaultY !== undefined ? widgetConfig.defaultY : this.props.appStore.floatingWidgetStore.defaultOffset,
                    width: widgetConfig.defaultWidth,
                    height: widgetConfig.defaultHeight + headerHeight,
                }}
                resizeGrid={[25, 25]}
                dragGrid={[25, 25]}
                minWidth={widgetConfig.minWidth}
                minHeight={widgetConfig.minHeight + headerHeight}
                bounds={".gl-container"}
                dragHandleClassName={"floating-title"}
                onMouseDown={this.props.onSelected}
            >
                <div className={titleClass}>
                    <div className={"floating-title"}>
                        {widgetConfig.title}
                    </div>
                    {this.props.showPinButton &&
                    <div className="floating-header-button" ref={ref => this.pinElementRef = ref}>
                        <Icon icon={"pin"}/>
                    </div>
                    }
                    {widgetConfig.isCloseable &&
                    <div onMouseDown={this.props.onClosed} className="floating-header-button">
                        <Icon icon={"cross"}/>
                    </div>
                    }
                </div>
                <div className="floating-content">
                    {this.props.children}
                </div>
            </Rnd>
        );
    }
}