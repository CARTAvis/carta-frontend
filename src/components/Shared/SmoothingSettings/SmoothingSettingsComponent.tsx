import * as React from "react";
import {observer} from "mobx-react";
import {FormGroup, HTMLSelect, IOptionProps, Switch} from "@blueprintjs/core";
import {ProfileSmoothingStore} from "stores";
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
export class SmoothingSettingsComponent extends React.Component<{smoothingStore: ProfileSmoothingStore}> {

    render() {
        const smoothingStore = this.props.smoothingStore;
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
                        value={smoothingStore && smoothingStore.type ? smoothingStore.type : SmoothingType.NONE}
                        options={smoothingTypeOptions}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => smoothingStore.setType(event.currentTarget.value as SmoothingType)}
                    />
                </FormGroup>
                {(smoothingStore.type !== SmoothingType.NONE) &&
                <React.Fragment>
                    <FormGroup inline={true} label="Color">
                        <ColorPickerComponent
                            color={smoothingStore.lineColor.colorHex}
                            presetColors={SWATCH_COLORS}
                            setColor={(color: ColorResult) => {
                                smoothingStore.setLineColor(color.hex, true);
                            }}
                            disableAlpha={true}
                            darkTheme={AppStore.Instance.darkTheme}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label={"Line Style"}>
                        <PlotTypeSelectorComponent value={smoothingStore.lineType} onValueChanged={smoothingStore.setLineType}/>
                    </FormGroup>
                    <FormGroup  inline={true} label="Line Width" labelInfo="(px)">
                        <SafeNumericInput
                            placeholder="Line Width"
                            min={0.5}
                            max={10}
                            value={smoothingStore.lineWidth}
                            stepSize={1}
                            // disabled={props.plotType === PlotType.POINTS}
                            onValueChange={(value: number) => smoothingStore.setLineWidth(value)}
                        />
                    </FormGroup>
                </React.Fragment>
                }
                {(smoothingStore.type !== SmoothingType.NONE) &&
                <React.Fragment>
                    <FormGroup label={"Overlay"} inline={true}>
                        <Switch checked={smoothingStore.isOverlayOn} onChange={(ev) => smoothingStore.setIsOverlayOn(ev.currentTarget.checked)}/>
                    </FormGroup>
                </React.Fragment>
                }
                {(smoothingStore.type === SmoothingType.BOXCAR) &&
                <FormGroup label={"Kernel"} inline={true}>
                    <SafeNumericInput
                        value={smoothingStore.boxcarSize}
                        min={2}
                        stepSize={1}
                        className="narrow"
                        onValueChange={val => smoothingStore.setBoxcarSize(Math.round(val))}
                    />
                </FormGroup>
                }
                {(smoothingStore.type === SmoothingType.GAUSSIAN) &&
                <FormGroup label={"Sigma"} inline={true}>
                    <SafeNumericInput
                        value={smoothingStore.gaussianSigma}
                        min={1}
                        className="narrow"
                        onValueChange={val => smoothingStore.setGaussianSigma(Number.parseFloat(val))}
                    />
                </FormGroup>
                }
                {(smoothingStore.type === SmoothingType.HANNING) &&
                <FormGroup label={"Kernel"} inline={true}>
                    <SafeNumericInput
                        value={smoothingStore.hanningSize}
                        min={3}
                        stepSize={2}
                        className="narrow"
                        onValueChange={val => smoothingStore.setHanningSize(Math.round(val))}
                    />
                </FormGroup>
                }
                {(smoothingStore.type === SmoothingType.DECIMATION) &&
                <FormGroup label={"Decimation Value"} inline={true}>
                    <SafeNumericInput
                        value={smoothingStore.decimationValue}
                        min={2}
                        stepSize={1}
                        className="narrow"
                        onValueChange={val => smoothingStore.setDecimationValue(Math.round(val))}
                    />
                </FormGroup>
                }
                {(smoothingStore.type === SmoothingType.BINNING) &&
                <FormGroup label={"Binning Width"} inline={true}>
                    <SafeNumericInput
                        value={smoothingStore.binWidth}
                        min={2}
                        stepSize={1}
                        className="narrow"
                        onValueChange={val => smoothingStore.setBinWidth(Math.round(val))}
                    />
                </FormGroup>
                }
                {(smoothingStore.type === SmoothingType.SAVITZKY_GOLAY) &&
                <React.Fragment>
                    <FormGroup label={"Kernel"} inline={true}>
                        <SafeNumericInput
                            value={smoothingStore.savitzkyGolaySize}
                            min={5}
                            stepSize={2}
                            className="narrow"
                            onValueChange={val => smoothingStore.setSavitzkyGolaySize(Math.round(val))}
                        />
                    </FormGroup>
                    <FormGroup label="Degree of Fitting" inline={true}>
                        <SafeNumericInput
                            value={smoothingStore.savitzkyGolayOrder}
                            min={0}
                            max={4}
                            stepSize={2}
                            className="narrow"
                            onValueChange={val => smoothingStore.setSavitzkyGolayOrder(Math.round(val))}
                        />
                    </FormGroup>
                </React.Fragment>
                }
            </React.Fragment>
        );
    }
}