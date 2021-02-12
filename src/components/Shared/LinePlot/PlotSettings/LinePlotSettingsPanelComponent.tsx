import * as React from "react";
import {observer} from "mobx-react";
import {FormGroup, Switch, Button, HTMLSelect} from "@blueprintjs/core";
import {ColorResult} from "react-color";
import {ColorPickerComponent, PlotTypeSelectorComponent, PlotType, SafeNumericInput} from "components/Shared";
import {SWATCH_COLORS} from "utilities";
import "./LinePlotSettingsPanelComponent.scss";

export class LinePlotSettingsPanelComponentProps {
    darkMode: boolean;
    primaryDarkModeLineColor: string;
    secondaryDarkModeLineColor?: string;
    primaryLineColor: {colorHex: string, fixed: boolean};
    secondaryLineColor?: {colorHex: string, fixed: boolean};
    lineWidth: number;
    plotType: PlotType;
    linePlotPointSize: number;
    useWcsValues?: boolean;
    showWCSAxis?: boolean;
    meanRmsVisible?: boolean;
    isAutoScaledX?: boolean;
    isAutoScaledY?: boolean;
    userSelectedCoordinate?: string;
    profileCoordinateOptions?: any;
    logScaleY?: boolean;
    markerTextVisible?: boolean;
    xMinVal?: number;
    xMaxVal?: number;
    yMinVal?: number;
    yMaxVal?: number;
    setPrimaryLineColor: (colorHex: string, fixed: boolean) => void;
    setSecondaryLineColor?: (colorHex: string, fixed: boolean) => void;
    setLineWidth: (val: number) => void;
    setLinePlotPointSize: (val: number) => void;
    setPlotType: (val: PlotType) => void;
    handleWcsValuesChanged?: (changeEvent: React.ChangeEvent<HTMLInputElement>) => void;
    handleMeanRmsChanged?: (changeEvent: React.ChangeEvent<HTMLInputElement>) => void;
    clearXYBounds?: () => void;
    handleCoordinateChanged?: (changeEvent: React.ChangeEvent<HTMLSelectElement>) => void;
    handleWcsAxisChanged?: (changeEvent: React.ChangeEvent<HTMLInputElement>) => void;
    handleLogScaleChanged?: (changeEvent: React.ChangeEvent<HTMLInputElement>) => void;
    handleMarkerTextChanged?: (changeEvent: React.ChangeEvent<HTMLInputElement>) => void;
    handleXMinChange?: (ev: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => void;
    handleXMaxChange?: (ev: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => void;
    handleYMinChange?: (ev: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => void;
    handleYMaxChange?: (ev: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => void; 
}

export enum LineSettings {
    MIN_WIDTH = 0.5,
    MAX_WIDTH = 10,
    MIN_POINT_SIZE = 0.5,
    MAX_POINT_SIZE = 10,
    POINT_SIZE_STEP_SIZE = 0.5,
    LINE_WIDTH_STEP_SIZE = 0.5
}

@observer
export class LinePlotSettingsPanelComponent extends React.Component<LinePlotSettingsPanelComponentProps> {
     
    private getThemeDefaultColor (darkThemeLineColor: string, lineColor: {colorHex: string, fixed: boolean}): string {
        if (this.props.darkMode && !lineColor.fixed) {
            return darkThemeLineColor;
        }
        return lineColor.colorHex;
    }

    render() {
        const props = this.props;
        return (
            <div className="line-settings-panel">
                <React.Fragment>
                    {props.userSelectedCoordinate && props.handleCoordinateChanged &&
                        <FormGroup label={"Coordinate"} inline={true}>
                            <HTMLSelect value={props.userSelectedCoordinate} options={props.profileCoordinateOptions} onChange={props.handleCoordinateChanged}/>
                        </FormGroup>
                    }
                    <FormGroup inline={true} label="Primary Color">
                        <ColorPickerComponent
                            color={this.getThemeDefaultColor(props.primaryDarkModeLineColor, props.primaryLineColor)}
                            presetColors={[...SWATCH_COLORS, "transparent"]}
                            setColor={(color: ColorResult) => {
                                props.setPrimaryLineColor(color.hex === "transparent" ? "#000000" : color.hex, true);
                            }}
                            disableAlpha={true}
                            darkTheme={props.darkMode}
                        />
                    </FormGroup>
                    {props.secondaryDarkModeLineColor 
                        && props.secondaryLineColor
                        && props.setSecondaryLineColor 
                        &&  <FormGroup inline={true} label="Secondary Color">
                                <ColorPickerComponent
                                    color={this.getThemeDefaultColor(props.secondaryDarkModeLineColor, props.secondaryLineColor)}
                                    presetColors={[...SWATCH_COLORS, "transparent"]}
                                    setColor={(color: ColorResult) => {
                                        props.setSecondaryLineColor(color.hex === "transparent" ? "#000000" : color.hex, true);
                                    }}
                                    disableAlpha={true}
                                    darkTheme={props.darkMode}
                                />
                            </FormGroup>
                    }
                    <FormGroup  inline={true} label="Line Width" labelInfo="(px)">
                        <SafeNumericInput
                            placeholder="Line Width"
                            min={LineSettings.MIN_WIDTH}
                            max={LineSettings.MAX_WIDTH}
                            value={props.lineWidth}
                            stepSize={LineSettings.LINE_WIDTH_STEP_SIZE}
                            disabled={props.plotType === PlotType.POINTS}
                            onValueChange={(value: number) => props.setLineWidth(value)}
                        />
                    </FormGroup>
                    <FormGroup  inline={true} label="Point Size" labelInfo="(px)">
                        <SafeNumericInput
                            placeholder="Point Size"
                            min={LineSettings.MIN_POINT_SIZE}
                            max={LineSettings.MAX_POINT_SIZE}
                            value={props.linePlotPointSize}
                            stepSize={LineSettings.POINT_SIZE_STEP_SIZE}
                            disabled={props.plotType !== PlotType.POINTS}
                            onValueChange={(value: number) => props.setLinePlotPointSize(value)}
                        />
                    </FormGroup>
                    { typeof props.logScaleY !== "undefined" && props.handleLogScaleChanged &&
                        <FormGroup inline={true} label={"Log Scale"}>
                            <Switch checked={props.logScaleY} onChange={props.handleLogScaleChanged}/>
                        </FormGroup>
                    }
                    { typeof props.markerTextVisible !== "undefined" && props.handleMarkerTextChanged &&
                        <FormGroup inline={true} label={"Show Labels"}>
                            <Switch checked={props.markerTextVisible} onChange={props.handleMarkerTextChanged}/>
                        </FormGroup>
                    }
                    {typeof props.useWcsValues !== "undefined" && props.handleWcsValuesChanged &&
                        <FormGroup inline={true} label={"Use WCS Values"}>
                            <Switch checked={props.useWcsValues} onChange={props.handleWcsValuesChanged}/>
                        </FormGroup>
                    }
                    {typeof props.showWCSAxis !== "undefined" && props.handleWcsAxisChanged &&
                        <FormGroup inline={true} label={"Show WCS Axis"}>
                            <Switch checked={props.showWCSAxis} onChange={props.handleWcsAxisChanged}/>
                        </FormGroup>
                    }
                    { typeof props.meanRmsVisible !== "undefined"
                        && props.handleMeanRmsChanged
                        &&  <FormGroup inline={true} label={"Show Mean/RMS"}>
                                <Switch checked={props.meanRmsVisible} onChange={props.handleMeanRmsChanged}/>
                            </FormGroup>
                    }
                    <FormGroup inline={true} label={"Line Style"}>
                        <PlotTypeSelectorComponent value={props.plotType} onValueChanged={props.setPlotType}/>
                    </FormGroup>
                    { typeof props.xMinVal !== "undefined"  && props.handleXMinChange &&
                    <FormGroup label={"X Min"} inline={true}>
                        <SafeNumericInput
                            className="line-boundary"
                            value={props.xMinVal}
                            selectAllOnFocus={true}
                            buttonPosition={"none"}
                            allowNumericCharactersOnly={true}
                            onBlur={props.handleXMinChange}
                            onKeyDown={props.handleXMinChange}
                        />
                    </FormGroup>
                    }
                    { typeof props.xMaxVal !== "undefined"  && props.handleXMaxChange &&
                    <FormGroup label={"X Max"} inline={true}>
                        <SafeNumericInput
                            className="line-boundary"
                            value={props.xMaxVal}
                            selectAllOnFocus={true}
                            buttonPosition={"none"}
                            allowNumericCharactersOnly={true}
                            onBlur={props.handleXMaxChange}
                            onKeyDown={props.handleXMaxChange}
                        />
                    </FormGroup>
                    }
                    { typeof props.yMinVal !== "undefined"  && props.handleYMinChange &&
                    <FormGroup label={"Y Min"} inline={true}>
                        <SafeNumericInput
                            className="line-boundary"
                            asyncControl={true}
                            value={props.yMinVal}
                            selectAllOnFocus={true}
                            buttonPosition={"none"}
                            allowNumericCharactersOnly={true}
                            onBlur={props.handleYMinChange}
                            onKeyDown={props.handleYMinChange}
                        />
                    </FormGroup>
                    }
                    { typeof props.yMaxVal !== "undefined"  && props.handleYMaxChange &&
                    <FormGroup label={"Y Max"} inline={true}>
                        <SafeNumericInput
                            className="line-boundary"
                            asyncControl={true}
                            value={props.yMaxVal}
                            selectAllOnFocus={true}
                            buttonPosition={"none"}
                            allowNumericCharactersOnly={true}
                            onBlur={props.handleYMaxChange}
                            onKeyDown={props.handleYMaxChange}
                        />
                    </FormGroup>
                    }
                    { typeof props.isAutoScaledX !== "undefined" 
                        &&  typeof props.isAutoScaledY !== "undefined"
                        &&  props.clearXYBounds
                        &&  <FormGroup inline={true} className="reset-range-content">
                                <Button className="reset-range-button" icon={"zoom-to-fit"} small={true} disabled={props.isAutoScaledX && props.isAutoScaledY} onClick={props.clearXYBounds}>Reset Range</Button>
                            </FormGroup>
                    }
                </React.Fragment>
            </div>
        );
    }
}
