import * as React from "react";
import {action, autorun, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, FormGroup, Intent, HTMLSelect, NonIdealState, Switch, Tooltip, MenuItem, PopoverPosition, Button} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
import {AppStore, HelpType, WidgetConfig, WidgetProps, WidgetsStore} from "stores";
import {SpectralLineOverlayWidgetStore} from "stores/widgets";
import "./SpectralLineOverlayComponent.css";

@observer
export class SpectralLineOverlayComponent extends React.Component<WidgetProps> {
    @observable width: number;
    @observable height: number;
    @observable widgetId: string;

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "spectral-line-overlay",
            type: "spectral-line-overlay",
            minWidth: 320,
            minHeight: 400,
            defaultWidth: 600,
            defaultHeight: 350,
            title: "Spectral Line Overlay",
            isCloseable: true,
            helpType: HelpType.SPECTRAL_LINE_OVERLAY,
            componentId: "spectral-line-overlay-component"
        };
    }

    @computed get widgetStore(): SpectralLineOverlayWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.spectralLineOverlayWidgets) {
            const widgetStore = widgetsStore.spectralLineOverlayWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new SpectralLineOverlayWidgetStore();
    }

    onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    render() {
        const appStore = AppStore.Instance;
        const widgetStore = this.widgetStore;

        if (!widgetStore) {
            return (
                <div className="spectral-line-overlay">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>;
                </div>
            );
        }

        let className = "spectral-line-overlay-widget";
        if (appStore.darkTheme) {
            className += " dark-theme";
        }

        return (
            <div className={className}>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}
