import * as React from "react";
import * as _ from "lodash";
import {computed, observable} from "mobx";
import {observer} from "mobx-react";
import {NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {LinePlotComponent, LinePlotComponentProps} from "components/Shared";
import {StokesAnalysisToolbarComponent} from "./StokesAnalysisToolbarComponent/StokesAnalysisToolbarComponent";
import {WidgetConfig, WidgetProps} from "stores";
import {StokesAnalysisWidgetStore} from "stores/widgets";
import "./StokesAnalysisComponent.css";

@observer
export class StokesAnalysisComponent extends React.Component<WidgetProps> {
    private static layoutRatioCutoffs = {
        vertical:  0.5,
        horizontal: 2,
        square: 1.1, 
    };

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "stokes",
            type: "stokes",
            minWidth: 300,
            minHeight: 390,
            defaultWidth: 600,
            defaultHeight: 800,
            title: "Stokes Analysis",
            isCloseable: true
        };
    }

    @observable width: number;
    @observable height: number;

    @computed get widgetStore(): StokesAnalysisWidgetStore {
        if (this.props.appStore && this.props.appStore.widgetsStore.stokesAnalysisWidgets) {
            const widgetStore = this.props.appStore.widgetsStore.stokesAnalysisWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new StokesAnalysisWidgetStore();
    }

    constructor(props: WidgetProps) {
        super(props);
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === StokesAnalysisComponent.WIDGET_CONFIG.type) {
            // Assign the next unique ID
            const id = props.appStore.widgetsStore.addStokesWidget();
            props.appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!this.props.appStore.widgetsStore.stokesAnalysisWidgets.has(this.props.id)) {
                console.log(`can't find store for widget with id=${this.props.id}`);
                this.props.appStore.widgetsStore.stokesAnalysisWidgets.set(this.props.id, new StokesAnalysisWidgetStore());
            }
        }
    }

    onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    private static calculateLayout = (width: number, height: number): string => {
        if (width && height) {
            let ratio = width / height;
            let verticalDiff = Math.abs(ratio - StokesAnalysisComponent.layoutRatioCutoffs.vertical);
            let horizontalDiff = Math.abs(ratio - StokesAnalysisComponent.layoutRatioCutoffs.horizontal);
            let squareDiff = Math.abs(ratio - StokesAnalysisComponent.layoutRatioCutoffs.square);

            let minValue = Math.min(verticalDiff, horizontalDiff, squareDiff);

            if (minValue === verticalDiff) {
                return "vertical";
            }
            else if (minValue === horizontalDiff) {
                return "horizontal";
            }
            else if (minValue === squareDiff) {
                return "square";
            }
            return null;
        }
        return null;
    }

    onGraphCursorMoved = _.throttle((x) => {
        this.widgetStore.setCursor(x);
    }, 33);

    render() {
        const appStore = this.props.appStore;
        if (!this.widgetStore) {
            return <NonIdealState icon={"error"} title={"Missing profile"} description={"Profile not found"}/>;
        }

        const imageName = (appStore.activeFrame ? appStore.activeFrame.frameInfo.fileInfo.name : undefined);

        let quLinePlotProps: LinePlotComponentProps = {
            xLabel: "Frequence (GHz)",
            yLabel: "Q + U",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "profile",
            forceScientificNotationTicksY: true,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true
        };

        let piLinePlotProps: LinePlotComponentProps = {
            xLabel: "Frequence (GHz)",
            yLabel: "PI",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "profile",
            forceScientificNotationTicksY: true,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true
        };

        let paLinePlotProps: LinePlotComponentProps = {
            xLabel: "Frequence (GHz)",
            yLabel: "PA",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "profile",
            forceScientificNotationTicksY: true,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true
        };

        let qvsuLinePlotProps: LinePlotComponentProps = {
            xLabel: "Q",
            yLabel: "U",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "profile",
            forceScientificNotationTicksY: true,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true
        };

        let className = "profile-container-" + StokesAnalysisComponent.calculateLayout(this.width, this.height);

        return (
            <div className={"stokes-widget"}>
                <div className={className}>
                    <div className="profile-plot-qup">
                        <StokesAnalysisToolbarComponent widgetStore={this.widgetStore} appStore={appStore}/>
                        <div className="profile-plot-qu">
                            <LinePlotComponent {...quLinePlotProps}/>
                        </div>
                        <div className="profile-plot-p">
                            <div className="profile-plot-pi">
                                <LinePlotComponent {...piLinePlotProps}/>
                            </div>
                            <div className="profile-plot-pa">
                                <LinePlotComponent {...paLinePlotProps}/>
                            </div>
                        </div>
                    </div>
                    <div className="profile-plot-qvsu">
                        <LinePlotComponent {...qvsuLinePlotProps}/>
                    </div>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}
