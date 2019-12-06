import * as React from "react";
import {computed, autorun} from "mobx";
import {observer} from "mobx-react";
import {Colors} from "@blueprintjs/core";
import {LinePlotSettingsPanelComponentProps, LinePlotSettingsPanelComponent} from "components/Shared";
import {SpatialProfileWidgetStore} from "stores/widgets";
import {WidgetProps, WidgetConfig} from "stores";

@observer
export class SpatialProfilerSettingsPanelComponent extends React.Component<WidgetProps> {

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "spatial-profiler-floating-settings",
            type: "floating-settings",
            minWidth: 280,
            minHeight: 225,
            defaultWidth: 300,
            defaultHeight: 410,
            title: "spatial-profiler-settings",
            isCloseable: true,
            parentId: "spatial-profiler",
            parentType: "spatial-profiler"
        };
    }

    @computed get widgetStore(): SpatialProfileWidgetStore {
        if (this.props.appStore && this.props.appStore.widgetsStore.spatialProfileWidgets) {
            const widgetStore = this.props.appStore.widgetsStore.spatialProfileWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return null;
    }

    constructor(props: WidgetProps) {
        super(props);

        // Update widget title when region or coordinate changes
        autorun(() => {
            if (this.widgetStore) {
                const coordinate = this.widgetStore.coordinate;
                const appStore = this.props.appStore;
                if (appStore && coordinate) {
                    const coordinateString = `${coordinate.toUpperCase()} Profile`;
                    const regionString = this.widgetStore.regionId === 0 ? "Cursor" : `Region #${this.widgetStore.regionId}`;
                    this.props.appStore.widgetsStore.setWidgetTitle(this.props.floatingSettingsId, `${coordinateString} Settings: ${regionString}`);
                }
            } else {
                this.props.appStore.widgetsStore.setWidgetTitle(this.props.floatingSettingsId, `X Profile Settings: Cursor`);
            }
        });
    }

    handleWcsAxisChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore.setWcsAxisVisible(changeEvent.target.checked);
    };

    handleMeanRmsChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore.setMeanRmsVisible(changeEvent.target.checked);
    };

    handleCoordinateChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.widgetStore.setCoordinate(changeEvent.target.value);
    };

    render() {
        const widgetStore = this.widgetStore;
        const profileCoordinateOptions = [{
            value: "x", label: "X"
        }, {
            value: "y", label: "Y"
        }];

        const lineSettingsProps: LinePlotSettingsPanelComponentProps = {
            darkMode: this.props.appStore.darkTheme,
            primaryDarkModeLineColor: Colors.BLUE4,
            primaryLineColor: widgetStore.primaryLineColor,
            lineWidth: widgetStore.lineWidth,
            plotType: widgetStore.plotType,
            linePlotPointSize: widgetStore.linePlotPointSize,
            showWCSAxis: widgetStore.wcsAxisVisible,
            setPrimaryLineColor: widgetStore.setPrimaryLineColor,
            setLineWidth: widgetStore.setLineWidth,
            setLinePlotPointSize: widgetStore.setLinePlotPointSize,
            handleWcsAxisChanged: this.handleWcsAxisChanged,
            setPlotType: widgetStore.setPlotType,
            meanRmsVisible: widgetStore.meanRmsVisible,
            handleMeanRmsChanged: this.handleMeanRmsChanged,
            isAutoScaledX: widgetStore.isAutoScaledX,
            isAutoScaledY: widgetStore.isAutoScaledY,
            clearXYBounds: widgetStore.clearXYBounds,
            userSelectedCoordinate: widgetStore.coordinate,
            handleCoordinateChanged: this.handleCoordinateChanged,
            profileCoordinateOptions: profileCoordinateOptions
        };
        return (
            <LinePlotSettingsPanelComponent {...lineSettingsProps}/>
        );
    }
}