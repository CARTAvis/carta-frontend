import * as React from "react";
import {Button, FormGroup, HTMLSelect, Switch} from "@blueprintjs/core";
import {observer} from "mobx-react";
import type {LineKey, LineOption} from "models";

import {AutoColorPickerComponent, PlotTypeSelectorComponent, SafeNumericInput} from "components/Shared";
import {LineSettings, PlotType} from "enums";
import {DEFAULT_COLOR, SWATCH_COLORS} from "utilities";

import "./LinePlotSettingsPanelComponent.scss";

export class LinePlotSettingsPanelComponentProps {
    lineColorMap: Map<LineKey, string>;
    lineOrderedKeys?: LineKey[];
    lineOptions?: LineOption[];
    lineWidth: number;
    plotType: PlotType;
    linePlotPointSize: number;
    shouldUseWcsValues?: boolean;
    shouldShowWCSAxis?: boolean;
    isShowWCSAxisDisabled?: boolean;
    isMeanRmsVisible?: boolean;
    isAutoScaledX?: boolean;
    isAutoScaledY?: boolean;
    userSelectedCoordinate?: string;
    profileCoordinateOptions?: any;
    isLogScaleY?: boolean;
    isMarkerTextVisible?: boolean;
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
    handleLogScaleChanged?: (changeEvent: React.ChangeEvent<HTMLInputElement>) => void;
    handleMarkerTextChanged?: (changeEvent: React.ChangeEvent<HTMLInputElement>) => void;
    handleXMinChange?: (ev: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => void;
    handleXMaxChange?: (ev: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => void;
    handleYMinChange?: (ev: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => void;
    handleYMaxChange?: (ev: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => void;
}

@observer
export class LinePlotSettingsPanelComponent extends React.Component<LinePlotSettingsPanelComponentProps> {
    private getLineColorSelectors = (): React.JSX.Element | null => {
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
                                label="Line color"
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
                    <FormGroup inline={true} label="Line width" labelInfo="(px)">
                        <SafeNumericInput
                            placeholder="Line width"
                            min={LineSettings.MIN_WIDTH}
                            max={LineSettings.MAX_WIDTH}
                            value={props.lineWidth}
                            stepSize={LineSettings.LINE_WIDTH_STEP_SIZE}
                            disabled={props.plotType === PlotType.POINTS}
                            onValueChange={(value: number) => props.setLineWidth(value)}
                            data-testid="profiler-settings-line-width-input"
                        />
                    </FormGroup>
                    <FormGroup inline={true} label="Point size" labelInfo="(px)">
                        <SafeNumericInput
                            placeholder="Point size"
                            min={LineSettings.MIN_POINT_SIZE}
                            max={LineSettings.MAX_POINT_SIZE}
                            value={props.linePlotPointSize}
                            stepSize={LineSettings.POINT_SIZE_STEP_SIZE}
                            disabled={props.plotType !== PlotType.POINTS}
                            onValueChange={(value: number) => props.setLinePlotPointSize(value)}
                        />
                    </FormGroup>
                    {typeof props.isLogScaleY !== "undefined" && props.handleLogScaleChanged && (
                        <FormGroup inline={true} label={"Log scale"}>
                            <Switch checked={props.isLogScaleY} onChange={props.handleLogScaleChanged} />
                        </FormGroup>
                    )}
                    {typeof props.isMarkerTextVisible !== "undefined" && props.handleMarkerTextChanged && (
                        <FormGroup inline={true} label={"Show labels"}>
                            <Switch checked={props.isMarkerTextVisible} onChange={props.handleMarkerTextChanged} />
                        </FormGroup>
                    )}
                    {typeof props.shouldUseWcsValues !== "undefined" && props.handleWcsValuesChanged && (
                        <FormGroup inline={true} label={"Use WCS values"}>
                            <Switch checked={props.shouldUseWcsValues} onChange={props.handleWcsValuesChanged} />
                        </FormGroup>
                    )}
                    {typeof props.shouldShowWCSAxis !== "undefined" && props.handleWcsAxisChanged && (
                        <FormGroup disabled={props.isShowWCSAxisDisabled} inline={true} label={"Show WCS axis"}>
                            <Switch disabled={props.isShowWCSAxisDisabled} checked={props.shouldShowWCSAxis} onChange={props.handleWcsAxisChanged} />
                        </FormGroup>
                    )}
                    {typeof props.isMeanRmsVisible !== "undefined" && props.handleMeanRmsChanged && (
                        <FormGroup inline={true} label={"Show mean/RMS"} helperText={"Only visible in single profile"}>
                            <Switch checked={props.isMeanRmsVisible} onChange={props.handleMeanRmsChanged} />
                        </FormGroup>
                    )}
                    <FormGroup inline={true} label={"Line style"}>
                        <PlotTypeSelectorComponent value={props.plotType} onValueChanged={props.setPlotType} />
                    </FormGroup>
                    {typeof props.xMinVal !== "undefined" && props.handleXMinChange && (
                        <FormGroup label={"X min"} inline={true}>
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
                        <FormGroup label={"X max"} inline={true}>
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
                        <FormGroup label={"Y min"} inline={true}>
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
                        <FormGroup label={"Y max"} inline={true}>
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
                        <FormGroup label={"Reset range"} inline={true} className="reset-range-content">
                            <Button className="reset-range-button" icon={"zoom-to-fit"} size="small" disabled={props.isAutoScaledX && props.isAutoScaledY} onClick={props.clearXYBounds}>
                                Reset range
                            </Button>
                        </FormGroup>
                    )}
                </React.Fragment>
            </div>
        );
    }
}
