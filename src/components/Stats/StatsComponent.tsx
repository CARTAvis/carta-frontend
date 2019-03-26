import * as React from "react";
import {observer} from "mobx-react";
import {computed} from "mobx";
import {ControlGroup, FormGroup, HTMLSelect, IOptionProps, Pre} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {WidgetConfig, WidgetProps} from "stores";
import {StatsWidgetStore} from "stores/widgets";
import "./StatsComponent.css";

@observer
export class StatsComponent extends React.Component<WidgetProps> {

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "stats",
            type: "stats",
            minWidth: 300,
            minHeight: 180,
            defaultWidth: 300,
            defaultHeight: 180,
            title: "Statistics",
            isCloseable: true
        };
    }

    @computed get widgetStore(): StatsWidgetStore {
        if (this.props.appStore && this.props.appStore.widgetsStore.statsWidgets) {
            const widgetStore = this.props.appStore.widgetsStore.statsWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new StatsWidgetStore();
    }

    @computed get statsData(): CARTA.RegionStatsData {
        const appStore = this.props.appStore;

        if (appStore.activeFrame) {
            let fileId = this.widgetStore.fileId;
            let regionId = this.widgetStore.regionId;
            // Replace "current file" fileId with active frame's fileId
            if (this.widgetStore.fileId === -1) {
                fileId = appStore.activeFrame.frameInfo.fileId;
            }

            const frameMap = appStore.regionStats.get(fileId);
            if (!frameMap) {
                return null;
            }
            return frameMap.get(regionId);
        }
        return null;
    }

    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.widgetStore.setRegionId(parseInt(changeEvent.target.value));
    };

    public render() {

        const appStore = this.props.appStore;

        // Fill region select options with all non-temporary regions that are closed
        let profileRegionOptions: IOptionProps[] = [{value: -1, label: "Image"}];
        if (appStore.activeFrame && appStore.activeFrame.regionSet) {
            profileRegionOptions = profileRegionOptions.concat(this.props.appStore.activeFrame.regionSet.regions.filter(r => !r.isTemporary && r.isClosedRegion).map(r => {
                return {
                    value: r.regionId,
                    label: r.nameString
                };
            }));
        }

        let statsDataString: string;
        if (this.statsData) {
            statsDataString = JSON.stringify(this.statsData);
        } else {
            statsDataString = "No stats received";
        }

        return (
            <div className={"stats-widget"}>
                <FormGroup className={"stats-settings-panel-form"}>
                    <ControlGroup fill={true} vertical={true}>
                        <FormGroup label={"Region"} inline={true}>
                            <HTMLSelect value={this.widgetStore.regionId} options={profileRegionOptions} onChange={this.handleRegionChanged}/>
                        </FormGroup>
                    </ControlGroup>
                </FormGroup>
                <div className="stats-display">
                    <Pre>{statsDataString}</Pre>
                </div>
            </div>
        );
    }
}