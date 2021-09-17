import * as React from "react";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {FormGroup, NonIdealState, Tabs, Tab, TabId, HTMLSelect} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {AppStore, DefaultWidgetConfig, FrameStore, HelpType, WidgetProps, WidgetsStore} from "stores";
import {PVGeneratorWidgetStore} from "stores/widgets";
import {SafeNumericInput} from "components/Shared";
import "./PVGeneratorComponent.scss";

export enum PVGeneratorComponentTabs {
    PV_IMAGE,
    PREVIEW_CUBE
}

@observer
export class PVGeneratorComponent extends React.Component<WidgetProps> {
    @observable selectedTabId: TabId = PVGeneratorComponentTabs.PV_IMAGE;

    @action private setSelectedTab = (tab: TabId) => {
        this.selectedTabId = tab;
    };
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "pv-generator",
            type: "pv-generator",
            minWidth: 350,
            minHeight: 350,
            defaultWidth: 650,
            defaultHeight: 350,
            title: "PV Generator",
            isCloseable: true,
            helpType: HelpType.SPATIAL_PROFILER
        };
    }

    @observable width: number;
    @observable height: number;

    @computed get widgetStore(): PVGeneratorWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.pvGeneratorWidgets) {
            const widgetStore = widgetsStore.pvGeneratorWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new PVGeneratorWidgetStore();
    }

    @computed get frame(): FrameStore {
        if (this.widgetStore) {
            return AppStore.Instance.getFrame(this.widgetStore.fileId);
        } else {
            return undefined;
        }
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        const appStore = AppStore.Instance;
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === PVGeneratorComponent.WIDGET_CONFIG.type) {
            // Assign the next unique ID
            const id = appStore.widgetsStore.addPVGeneratorWidget();
            appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!appStore.widgetsStore.pvGeneratorWidgets.has(this.props.id)) {
                console.log(`can't find store for widget with id=${this.props.id}`);
                appStore.widgetsStore.pvGeneratorWidgets.set(this.props.id, new PVGeneratorWidgetStore());
            }
        }
    }

    @action private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    render() {
        const appStore = AppStore.Instance;
        const pvImagePanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Image">
                    <HTMLSelect value={this.widgetStore.imageId} options={appStore.frameNames} onChange={ev => this.widgetStore.setImageId(parseInt(ev.currentTarget.value))} />
                </FormGroup>
                <FormGroup inline={true} label="Average (px)">
                    <SafeNumericInput min={0} max={10} stepSize={0} value={this.widgetStore.average} onValueChange={value => this.widgetStore.setAverage(value)} />
                </FormGroup>
            </div>
        );

        return (
            <div className="pv-generator-widget">
                <NonIdealState icon={"folder-open"} title={""} description={"Use the Generate preview cube tab to view the preview pv image interactivly "} />
                <div className="pv-generator-panel">
                    <Tabs id="pvGeneratorTabs" selectedTabId={this.selectedTabId} onChange={this.setSelectedTab}>
                        <Tab id={PVGeneratorComponentTabs.PV_IMAGE} title="Generate PV image" panel={pvImagePanel} />
                    </Tabs>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}></ReactResizeDetector>
            </div>
        );
    }
}
