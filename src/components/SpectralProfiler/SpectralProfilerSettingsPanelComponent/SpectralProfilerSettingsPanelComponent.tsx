import * as React from "react";
import {computed, autorun} from "mobx";
import {observer} from "mobx-react";
import {Colors} from "@blueprintjs/core";
import {LinePlotSettingsPanelComponentProps, LinePlotSettingsPanelComponent, SpectralSettingsComponent} from "components/Shared";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {WidgetProps, WidgetConfig, HelpType} from "stores";
import {parseNumber} from "utilities";

const KEYCODE_ENTER = 13;

@observer
export class SpectralProfilerSettingsPanelComponent extends React.Component<WidgetProps> {

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "spectral-profiler-floating-settings",
            type: "floating-settings",
            minWidth: 280,
            minHeight: 225,
            defaultWidth: 350,
            defaultHeight: 375,
            title: "spectral-profiler-settings",
            isCloseable: true,
            parentId: "spectal-profiler",
            parentType: "spectral-profiler",
            helpType: HelpType.SPECTRAL_PROFILER_SETTINGS
        };
    }

    @computed get widgetStore(): SpectralProfileWidgetStore {
        if (this.props.appStore && this.props.appStore.widgetsStore.spectralProfileWidgets) {
            const widgetStore = this.props.appStore.widgetsStore.spectralProfileWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return null;
    }

    constructor(props: WidgetProps) {
        super(props);

        autorun(() => {
            if (this.widgetStore) {
                const appStore = this.props.appStore;
                const frame = appStore.activeFrame;
                const coordinate = this.widgetStore.coordinate;
                if (frame && coordinate) {
                    let coordinateString: string;
                    if (coordinate.length === 2) {
                        coordinateString = `Z Profile (Stokes ${coordinate[0]})`;
                    } else {
                        coordinateString = `Z Profile`;
                    }
                    const regionId = this.widgetStore.effectiveRegionId;
                    const regionString = regionId === 0 ? "Cursor" : `Region #${regionId}`;
                    const selectedString = this.widgetStore.matchesSelectedRegion ? "(Active)" : "";
                    this.props.appStore.widgetsStore.setWidgetTitle(this.props.floatingSettingsId, `${coordinateString} Settings: ${regionString} ${selectedString}`);
                }
            }
        });
    }

    handleMeanRmsChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore.setMeanRmsVisible(changeEvent.target.checked);
    };

    handleXMinChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore; 
        const minX = parseNumber(widgetStore.minX, widgetStore.linePlotInitXYBoundaries.minXVal);
        const maxX = parseNumber(widgetStore.maxX, widgetStore.linePlotInitXYBoundaries.maxXVal);
        if (isFinite(val) && val !== minX && val < maxX) {
            widgetStore.setXBounds(val, maxX);
        } else {
            ev.currentTarget.value = minX.toString();
        }
    };

    handleXMaxChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        const minX = parseNumber(widgetStore.minX, widgetStore.linePlotInitXYBoundaries.minXVal);
        const maxX = parseNumber(widgetStore.maxX, widgetStore.linePlotInitXYBoundaries.maxXVal);
        if (isFinite(val) && val !== maxX && val > minX) {
            widgetStore.setXBounds(minX, val);
        } else {
            ev.currentTarget.value = maxX.toString();
        }
    };

    handleYMinChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        const minY = parseNumber(widgetStore.minY, widgetStore.linePlotInitXYBoundaries.minYVal);
        const maxY = parseNumber(widgetStore.maxY, widgetStore.linePlotInitXYBoundaries.maxYVal);
        if (isFinite(val) && val !== minY && val < maxY) {
            widgetStore.setYBounds(val, maxY);
        } else {
            ev.currentTarget.value = minY.toString();
        }
    };

    handleYMaxChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        const minY = parseNumber(widgetStore.minY, widgetStore.linePlotInitXYBoundaries.minYVal);
        const maxY = parseNumber(widgetStore.maxY, widgetStore.linePlotInitXYBoundaries.maxYVal);
        if (isFinite(val) && val !== maxY && val > minY) {
            widgetStore.setYBounds(minY, val);
        } else {
            ev.currentTarget.value = maxY.toString();
        }
    };

    render() {
        const widgetStore = this.widgetStore;
        const lineSettingsProps: LinePlotSettingsPanelComponentProps = {
            darkMode: this.props.appStore.darkTheme,
            primaryDarkModeLineColor: Colors.BLUE4,
            primaryLineColor: widgetStore.primaryLineColor,
            lineWidth: widgetStore.lineWidth,
            plotType: widgetStore.plotType,
            linePlotPointSize: widgetStore.linePlotPointSize,
            setPrimaryLineColor: widgetStore.setPrimaryLineColor,
            setLineWidth: widgetStore.setLineWidth,
            setLinePlotPointSize: widgetStore.setLinePlotPointSize,
            setPlotType: widgetStore.setPlotType,
            meanRmsVisible: widgetStore.meanRmsVisible,
            handleMeanRmsChanged: this.handleMeanRmsChanged,
            isAutoScaledX: widgetStore.isAutoScaledX,
            isAutoScaledY: widgetStore.isAutoScaledY,
            clearXYBounds: widgetStore.clearXYBounds,
            xMinVal: parseNumber(widgetStore.minX, widgetStore.linePlotInitXYBoundaries.minXVal),
            handleXMinChange: this.handleXMinChange,
            xMaxVal: parseNumber(widgetStore.maxX, widgetStore.linePlotInitXYBoundaries.maxXVal),
            handleXMaxChange: this.handleXMaxChange,
            yMinVal: parseNumber(widgetStore.minY, widgetStore.linePlotInitXYBoundaries.minYVal),
            handleYMinChange: this.handleYMinChange,
            yMaxVal: parseNumber(widgetStore.maxY, widgetStore.linePlotInitXYBoundaries.maxYVal),
            handleYMaxChange: this.handleYMaxChange
        };

        return (
            <React.Fragment>
                <SpectralSettingsComponent appStore={this.props.appStore} widgetStore={widgetStore} disable={false}/>
                <LinePlotSettingsPanelComponent {...lineSettingsProps}/>
            </React.Fragment>
        );
    }
}