import * as React from "react";
import {observer} from "mobx-react";
import {FormGroup, Switch, Button, HTMLSelect} from "@blueprintjs/core";
import {AutoColorPickerComponent, PlotTypeSelectorComponent, PlotType, SafeNumericInput} from "components/Shared";
import {LineKey, LineOption} from "models";
import {DEFAULT_COLOR, SWATCH_COLORS} from "utilities";
import "./LinePlotSettingsPanelComponent.scss";

export class LinePlotSettingsPanelComponentProps {
    lineColorMap: Map<LineKey, string>;
    lineOrderedKeys?: LineKey[];
    lineOptions?: LineOption[];
    lineWidth: number;
    plotType: PlotType;
    linePlotPointSize: number;
    useWcsValues?: boolean;
    showWCSAxis?: boolean;
    optionalSpectralAxisVisible?: boolean;
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
    setLineColor: (lineKey: LineKey, color: string) => void;
    setLineWidth: (val: number) => void;
    setLinePlotPointSize: (val: number) => void;
    setPlotType: (val: PlotType) => void;
    handleWcsValuesChanged?: (changeEvent: React.ChangeEvent<HTMLInputElement>) => void;
    handleMeanRmsChanged?: (changeEvent: React.ChangeEvent<HTMLInputElement>) => void;
    clearXYBounds?: () => void;
    handleCoordinateChanged?: (changeEvent: React.ChangeEvent<HTMLSelectElement>) => void;
    handleWcsAxisChanged?: (changeEvent: React.ChangeEvent<HTMLInputElement>) => void;
    handleSecondarySpectralAxisChanged?: (changeEvent: React.ChangeEvent<HTMLInputElement>) => void;
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
    private getLineColorSelectors = (): JSX.Element => {
        const lineColorMap = this.props.lineColorMap;
        const setLineColor = this.props.setLineColor;
        if (lineColorMap && setLineColor) {
            const lineKeys = this.props.lineOrderedKeys ?? Array.from(lineColorMap.keys());
            return (
                <React.Fragment>
                    {lineKeys.map((lineKey, index) => {
                        const lineLabel = this.props.lineOptions?.find(option => option.value === lineKey)?.label;
                        return (
                            <FormGroup
                                key={index}
                                inline={true}
                                label="Line Color"
                                labelInfo={
                                    lineLabel ? (
                                        <React.Fragment>
                                            (
                                            <span className="line-label" title={lineLabel}>
                                                {lineLabel}
                                            </span>
                                            )
                                        </React.Fragment>
                                    ) : (
                                        ""
                                    )
                                }
                            >
                                <AutoColorPickerComponent
                                    color={lineColorMap.get(lineKey) ?? DEFAULT_COLOR}
                                    presetColors={[...SWATCH_COLORS, "transparent"]}
                                    setColor={(color: string) => {
                                        setLineColor(lineKey, color === "transparent" ? "#000000" : color);
                                    }}
                                    disableAlpha={true}
                                />
                            </FormGroup>
                        );
                    })}
                </React.Fragment>
            );
        }
        return null;
    };

    render() {
        const props = this.props;
        return (
            <div className="line-settings-panel">
                <React.Fragment>
                    {props.userSelectedCoordinate && props.handleCoordinateChanged && (
                        <FormGroup label={"Coordinate"} inline={true}>
                            <HTMLSelect value={props.userSelectedCoordinate} options={props.profileCoordinateOptions} onChange={props.handleCoordinateChanged} />
                        </FormGroup>
                    )}
                    {this.getLineColorSelectors()}
                    <FormGroup inline={true} label="Line Width" labelInfo="(px)">
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
                    <FormGroup inline={true} label="Point Size" labelInfo="(px)">
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
                    {typeof props.logScaleY !== "undefined" && props.handleLogScaleChanged && (
                        <FormGroup inline={true} label={"Log Scale"}>
                            <Switch checked={props.logScaleY} onChange={props.handleLogScaleChanged} />
                        </FormGroup>
                    )}
                    {typeof props.markerTextVisible !== "undefined" && props.handleMarkerTextChanged && (
                        <FormGroup inline={true} label={"Show Labels"}>
                            <Switch checked={props.markerTextVisible} onChange={props.handleMarkerTextChanged} />
                        </FormGroup>
                    )}
                    {typeof props.useWcsValues !== "undefined" && props.handleWcsValuesChanged && (
                        <FormGroup inline={true} label={"Use WCS Values"}>
                            <Switch checked={props.useWcsValues} onChange={props.handleWcsValuesChanged} />
                        </FormGroup>
                    )}
                    {typeof props.showWCSAxis !== "undefined" && props.handleWcsAxisChanged && (
                        <FormGroup inline={true} label={"Show WCS Axis"}>
                            <Switch checked={props.showWCSAxis} onChange={props.handleWcsAxisChanged} />
                        </FormGroup>
                    )}
                    {typeof props.optionalSpectralAxisVisible !== "undefined" && props.handleSecondarySpectralAxisChanged && (
                        <FormGroup inline={true} label={"Show Secondary Axis"}>
                            <Switch checked={props.optionalSpectralAxisVisible} onChange={props.handleSecondarySpectralAxisChanged} />
                        </FormGroup>
                    )}
                    {typeof props.meanRmsVisible !== "undefined" && props.handleMeanRmsChanged && (
                        <FormGroup inline={true} label={"Show Mean/RMS"} helperText={"Only visible in single profile"}>
                            <Switch checked={props.meanRmsVisible} onChange={props.handleMeanRmsChanged} />
                        </FormGroup>
                    )}
                    <FormGroup inline={true} label={"Line Style"}>
                        <PlotTypeSelectorComponent value={props.plotType} onValueChanged={props.setPlotType} />
                    </FormGroup>
                    {typeof props.xMinVal !== "undefined" && props.handleXMinChange && (
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
                    )}
                    {typeof props.xMaxVal !== "undefined" && props.handleXMaxChange && (
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
                    )}
                    {typeof props.yMinVal !== "undefined" && props.handleYMinChange && (
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
                    )}
                    {typeof props.yMaxVal !== "undefined" && props.handleYMaxChange && (
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
                    )}
                    {typeof props.isAutoScaledX !== "undefined" && typeof props.isAutoScaledY !== "undefined" && props.clearXYBounds && (
                        <FormGroup label={"Reset Range"} inline={true} className="reset-range-content">
                            <Button className="reset-range-button" icon={"zoom-to-fit"} small={true} disabled={props.isAutoScaledX && props.isAutoScaledY} onClick={props.clearXYBounds}>
                                Reset Range
                            </Button>
                        </FormGroup>
                    )}
                </React.Fragment>
            </div>
        );
    }
}
