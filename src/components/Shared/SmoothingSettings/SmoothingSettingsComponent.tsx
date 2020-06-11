import * as React from "react";
import {observer} from "mobx-react";
import {FormGroup, HTMLSelect, IOptionProps, Switch} from "@blueprintjs/core";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {ColorPickerComponent, SafeNumericInput, PlotTypeSelectorComponent} from "components/Shared";
import {ColorResult} from "react-color";
import {SWATCH_COLORS} from "utilities";
import { AppStore } from "stores";

export enum SmoothingType {
    NONE = "None",
    HANNING = "Hanning",
    BOXCAR = "Boxcar",
    GAUSSIAN = "Gaussian",
    DECIMATION = "Decimation",
    BINNING = "Binning",
    SAVITZKY_GOLAY = "Savitzky-Golay"
}

@observer
export class SmoothingSettingsComponent extends React.Component<{widgetStore: SpectralProfileWidgetStore}> {

    render() {
        const widgetStore = this.props.widgetStore;
        const smoothingTypeOptions: IOptionProps[] = [
            {value: SmoothingType.NONE, label: "None"},
            {value: SmoothingType.BOXCAR, label: "Boxcar"},
            {value: SmoothingType.GAUSSIAN, label: "Gaussian"},
            {value: SmoothingType.HANNING, label: "Hanning"},
            {value: SmoothingType.DECIMATION, label: "Decimation"},
            {value: SmoothingType.BINNING, label: "Binning"},
            {value: SmoothingType.SAVITZKY_GOLAY, label: "Savitzky-Golay"}
        ];

        return (
            <React.Fragment>
                <FormGroup label={"Method"} inline={true}>
                    <HTMLSelect
                        value={widgetStore && widgetStore.smoothingType ? widgetStore.smoothingType : SmoothingType.NONE}
                        options={smoothingTypeOptions}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => widgetStore.setSmoothingType(event.currentTarget.value as SmoothingType)}
                    />
                </FormGroup>
                {(widgetStore.smoothingType !== SmoothingType.NONE) &&
                <React.Fragment>
                    <FormGroup inline={true} label="Color">
                        <ColorPickerComponent
                            color={widgetStore.smoothingLineColor.colorHex}
                            presetColors={SWATCH_COLORS}
                            setColor={(color: ColorResult) => {
                                widgetStore.setSmoothingLineColor(color.hex, true);
                            }}
                            disableAlpha={true}
                            darkTheme={AppStore.Instance.darkTheme}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label={"Line Style"}>
                        <PlotTypeSelectorComponent value={widgetStore.smoothingLineType} onValueChanged={widgetStore.setSmoothingLineType}/>
                    </FormGroup>
                    <FormGroup  inline={true} label="Line Width" labelInfo="(px)">
                        <SafeNumericInput
                            placeholder="Line Width"
                            min={0.5}
                            max={10}
                            value={widgetStore.smoothingLineWidth}
                            stepSize={1}
                            // disabled={props.plotType === PlotType.POINTS}
                            onValueChange={(value: number) => widgetStore.setSmoothingLineWidth(value)}
                        />
                    </FormGroup>
                </React.Fragment>
                }
                {(widgetStore.smoothingType !== SmoothingType.NONE) &&
                <React.Fragment>
                    <FormGroup label={"Overlay"} inline={true}>
                        <Switch checked={widgetStore.isSmoothingOverlayOn} onChange={(ev) => widgetStore.setIsSmoothingOverlayOn(ev.currentTarget.checked)}/>
                    </FormGroup>
                </React.Fragment>
                }
                {(widgetStore.smoothingType === SmoothingType.BOXCAR) &&
                <FormGroup label={"Kernel"} inline={true}>
                    <SafeNumericInput
                        value={widgetStore.smoothingBoxcarSize}
                        min={2}
                        stepSize={1}
                        className="narrow"
                        onValueChange={val => widgetStore.setSmoothingBoxcarSize(Math.round(val))}
                    />
                </FormGroup>
                }
                {(widgetStore.smoothingType === SmoothingType.GAUSSIAN) &&
                <FormGroup label={"Sigma"} inline={true}>
                    <SafeNumericInput
                        value={widgetStore.smoothingGaussianSigma}
                        min={1}
                        className="narrow"
                        onValueChange={val => widgetStore.setSmoothingGaussianSigma(Number.parseFloat(val))}
                    />
                </FormGroup>
                }
                {(widgetStore.smoothingType === SmoothingType.HANNING) &&
                <FormGroup label={"Kernel"} inline={true}>
                    <SafeNumericInput
                        value={widgetStore.smoothingHanningSize}
                        min={3}
                        stepSize={2}
                        className="narrow"
                        onValueChange={val => widgetStore.setSmoothingHanningSize(Math.round(val))}
                    />
                </FormGroup>
                }
                {(widgetStore.smoothingType === SmoothingType.DECIMATION) &&
                <FormGroup label={"Decimation Value"} inline={true}>
                    <SafeNumericInput
                        value={widgetStore.smoothingDecimationValue}
                        min={2}
                        stepSize={1}
                        className="narrow"
                        onValueChange={val => widgetStore.setSmoothingDecimationValue(Math.round(val))}
                    />
                </FormGroup>
                }
                {(widgetStore.smoothingType === SmoothingType.BINNING) &&
                <FormGroup label={"Binning Width"} inline={true}>
                    <SafeNumericInput
                        value={widgetStore.smoothingBinWidth}
                        min={2}
                        stepSize={1}
                        className="narrow"
                        onValueChange={val => widgetStore.setSmoothingBinWidth(Math.round(val))}
                    />
                </FormGroup>
                }
                {(widgetStore.smoothingType === SmoothingType.SAVITZKY_GOLAY) &&
                <React.Fragment>
                    <FormGroup label={"Kernel"} inline={true}>
                        <SafeNumericInput
                            value={widgetStore.smoothingSavitzkyGolaySize}
                            min={5}
                            stepSize={2}
                            className="narrow"
                            onValueChange={val => widgetStore.setSmoothingSavitzkyGolaySize(Math.round(val))}
                            />
                    </FormGroup>
                    <FormGroup label="Degree of Fitting" inline={true}>
                        <SafeNumericInput
                            value={widgetStore.smoothingSavitzkyGolayOrder}
                            min={0}
                            max={4}
                            stepSize={1}
                            className="narrow"
                            onValueChange={val => widgetStore.setSmoothingSavitzkyGolayOrder(Math.round(val))}
                        />
                    </FormGroup>
                </React.Fragment>
                }
            </React.Fragment>
        );
    }
}