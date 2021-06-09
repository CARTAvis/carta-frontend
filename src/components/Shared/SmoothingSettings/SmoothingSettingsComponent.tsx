import * as React from "react";
import {observer} from "mobx-react";
import {FormGroup, HTMLSelect, IOptionProps, Switch} from "@blueprintjs/core";
import {ProfileSmoothingStore} from "stores";
import {AutoColorPickerComponent, SafeNumericInput, PlotTypeSelectorComponent, PlotType, LineSettings} from "components/Shared";
import {SWATCH_COLORS} from "utilities";
import "./SmoothingSettingsComponent.scss";

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
export class SmoothingSettingsComponent extends React.Component<{
    smoothingStore: ProfileSmoothingStore;
    diableDecimation?: boolean;
    diableStyle?: boolean;
    disableColorAndLineWidth?: boolean;
}> {
    private handleSelectedLineChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.props.smoothingStore.setSelectedLine(changeEvent.target.value);
    };

    render() {
        const smoothingStore = this.props.smoothingStore;
        const smoothingTypeOptions: IOptionProps[] = [
            {value: SmoothingType.NONE, label: "None"},
            {value: SmoothingType.BOXCAR, label: "Boxcar"},
            {value: SmoothingType.GAUSSIAN, label: "Gaussian"},
            {value: SmoothingType.HANNING, label: "Hanning"},
            {value: SmoothingType.BINNING, label: "Binning"},
            {value: SmoothingType.SAVITZKY_GOLAY, label: "Savitzky-Golay"}
        ];

        if (!this.props.diableDecimation) {
            smoothingTypeOptions.push({value: SmoothingType.DECIMATION, label: "Decimation"});
        }

        let colorKeys: IOptionProps[] = [];
        if (smoothingStore.colorMap.size > 0) {
            smoothingStore.colorMap.forEach((v, k) => {
                colorKeys = colorKeys.concat({value: k, label: k});
            });
        }

        return (
            <div className="smoothing-settings-panel">
                <FormGroup label={"Method"} inline={true}>
                    <HTMLSelect
                        value={smoothingStore && smoothingStore.type ? smoothingStore.type : SmoothingType.NONE}
                        options={smoothingTypeOptions}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => smoothingStore.setType(event.currentTarget.value as SmoothingType)}
                    />
                </FormGroup>
                {smoothingStore.type !== SmoothingType.NONE && !this.props.diableStyle && (
                    <React.Fragment>
                        {!this.props.disableColorAndLineWidth && (
                            <FormGroup inline={true} label="Color">
                                {smoothingStore.colorMap.size > 0 && (
                                    <HTMLSelect value={smoothingStore.selectedLine} options={colorKeys} onChange={this.handleSelectedLineChanged} />
                                )}
                                <AutoColorPickerComponent
                                    color={
                                        smoothingStore.selectedLine && smoothingStore.colorMap.get(smoothingStore.selectedLine)
                                            ? smoothingStore.colorMap.get(smoothingStore.selectedLine)
                                            : smoothingStore.lineColor
                                    }
                                    presetColors={SWATCH_COLORS}
                                    setColor={(color: string) => {
                                        if (smoothingStore.selectedLine && smoothingStore.colorMap.get(smoothingStore.selectedLine)) {
                                            smoothingStore.setColorMap(smoothingStore.selectedLine, color);
                                        } else {
                                            smoothingStore.setLineColor(color);
                                        }
                                    }}
                                    disableAlpha={true}
                                />
                            </FormGroup>
                        )}
                        <FormGroup inline={true} label={"Line Style"}>
                            <PlotTypeSelectorComponent value={smoothingStore.lineType} onValueChanged={smoothingStore.setLineType} />
                        </FormGroup>
                        {!this.props.disableColorAndLineWidth && (
                            <FormGroup inline={true} label="Line Width" labelInfo="(px)">
                                <SafeNumericInput
                                    placeholder="Line Width"
                                    min={LineSettings.MIN_WIDTH}
                                    max={LineSettings.MAX_WIDTH}
                                    value={smoothingStore.lineWidth}
                                    stepSize={1}
                                    disabled={smoothingStore.lineType === PlotType.POINTS}
                                    onValueChange={(value: number) => smoothingStore.setLineWidth(value)}
                                />
                            </FormGroup>
                        )}
                        <FormGroup inline={true} label="Point Size" labelInfo="(px)">
                            <SafeNumericInput
                                placeholder="Point Size"
                                min={LineSettings.MIN_POINT_SIZE}
                                max={LineSettings.MAX_POINT_SIZE}
                                value={smoothingStore.pointRadius}
                                stepSize={LineSettings.POINT_SIZE_STEP_SIZE}
                                disabled={smoothingStore.lineType !== PlotType.POINTS}
                                onValueChange={(value: number) => smoothingStore.setPointRadius(value)}
                            />
                        </FormGroup>
                    </React.Fragment>
                )}
                {smoothingStore.type !== SmoothingType.NONE && (
                    <FormGroup label={"Overlay"} inline={true}>
                        <Switch checked={smoothingStore.isOverlayOn} onChange={ev => smoothingStore.setIsOverlayOn(ev.currentTarget.checked)} />
                    </FormGroup>
                )}
                {smoothingStore.type === SmoothingType.BOXCAR && (
                    <FormGroup label={"Kernel"} inline={true}>
                        <SafeNumericInput
                            value={smoothingStore.boxcarSize}
                            min={2}
                            stepSize={1}
                            className="narrow"
                            onValueChange={val => smoothingStore.setBoxcarSize(Math.round(val))}
                        />
                    </FormGroup>
                )}
                {smoothingStore.type === SmoothingType.GAUSSIAN && (
                    <FormGroup label={"Sigma"} inline={true}>
                        <SafeNumericInput
                            value={smoothingStore.gaussianSigma}
                            min={1}
                            className="narrow"
                            onValueChange={val => smoothingStore.setGaussianSigma(val)}
                        />
                    </FormGroup>
                )}
                {smoothingStore.type === SmoothingType.HANNING && (
                    <FormGroup label={"Kernel"} inline={true}>
                        <SafeNumericInput
                            value={smoothingStore.hanningSize}
                            min={3}
                            stepSize={2}
                            className="narrow"
                            onValueChange={val => smoothingStore.setHanningSize(Math.round(val))}
                        />
                    </FormGroup>
                )}
                {smoothingStore.type === SmoothingType.DECIMATION && (
                    <FormGroup label={"Decimation Width"} inline={true}>
                        <SafeNumericInput
                            value={smoothingStore.decimationWidth}
                            min={2}
                            stepSize={1}
                            className="narrow"
                            onValueChange={val => smoothingStore.setDecimationWidth(Math.round(val))}
                        />
                    </FormGroup>
                )}
                {smoothingStore.type === SmoothingType.BINNING && (
                    <FormGroup label={"Binning Width"} inline={true}>
                        <SafeNumericInput
                            value={smoothingStore.binWidth}
                            min={2}
                            stepSize={1}
                            className="narrow"
                            onValueChange={val => smoothingStore.setBinWidth(Math.round(val))}
                        />
                    </FormGroup>
                )}
                {smoothingStore.type === SmoothingType.SAVITZKY_GOLAY && (
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
                )}
            </div>
        );
    }
}
