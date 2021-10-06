import * as React from "react";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {FormGroup, Tabs, Tab, TabId, HTMLSelect, AnchorButton, Position} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import ReactResizeDetector from "react-resize-detector";
import {AppStore, DefaultWidgetConfig, HelpType, WidgetProps, WidgetsStore} from "stores";
import {PVGeneratorWidgetStore, RegionId} from "stores/widgets";
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
            minHeight: 200,
            defaultWidth: 500,
            defaultHeight: 300,
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

    private handleFrameChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            const selectedFileId = parseInt(changeEvent.target.value);
            this.widgetStore.setFileId(selectedFileId);
            this.widgetStore.setRegionId(this.widgetStore.effectiveFrame.frameInfo.fileId, RegionId.ACTIVE);
        }
    };

    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            const fileId = this.widgetStore.effectiveFrame.frameInfo.fileId;
            this.widgetStore.setFileId(fileId);
            this.widgetStore.setRegionId(fileId, parseInt(changeEvent.target.value));
        }
    };

    render() {
        let selectedValue = RegionId.ACTIVE;
        if (this.widgetStore.effectiveFrame?.regionSet) {
            selectedValue = this.widgetStore.regionIdMap.get(this.widgetStore.effectiveFrame.frameInfo.fileId);
        }

        const disabledButton = !this.widgetStore.effectiveRegion;

        const pvImagePanel = (
            <div className="pv-image-panel">
                <FormGroup inline={true} label="Image">
                    <HTMLSelect value={this.widgetStore.fileId} options={this.widgetStore.frameOptions} onChange={this.handleFrameChanged} />
                </FormGroup>
                <FormGroup inline={true} label="Region">
                    <HTMLSelect value={selectedValue} options={this.widgetStore.regionOptions} onChange={this.handleRegionChanged} />
                </FormGroup>
                <FormGroup inline={true} label="Average (px)">
                    <SafeNumericInput min={1} max={10} stepSize={1} value={this.widgetStore.average} onValueChange={value => this.widgetStore.setAverage(value)} />
                </FormGroup>
                <div className="generate-button">
                    <Tooltip2 disabled={!disabledButton} content="Please select Line region" position={Position.BOTTOM}>
                        <AnchorButton intent="success" disabled={disabledButton} text="Generate" />
                    </Tooltip2>
                </div>
            </div>
        );

        return (
            <div className="pv-generator-widget">
                {/* <NonIdealState icon={"folder-open"} title={""} description={"Use the Generate preview cube tab to view the preview pv image interactivly "} /> */}
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
