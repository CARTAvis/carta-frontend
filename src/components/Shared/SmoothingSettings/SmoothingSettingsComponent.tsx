import * as React from "react";
import {observer} from "mobx-react";
import {FormGroup, HTMLSelect, IOptionProps} from "@blueprintjs/core";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {SafeNumericInput} from "components/Shared";

export enum SmoothingType {
    NONE = "None",
    HANNING = "Hanning",
    BOXCAR = "Boxcar",
    GAUSSIAN = "Gaussian",
    DECIMATION = "Decimation",
    BINNING = "Binning",
    SAVITZKT_GOLAY = "Savitzky-Golay"
}

@observer
export class SmoothingSettingsComponent extends React.Component<{widgetStore: SpectralProfileWidgetStore}> {

    render() {
        const widgetStore = this.props.widgetStore;
        const smoothingTypeOptions: IOptionProps[] = [
            {value: SmoothingType.NONE, label: "None"},
            {value: SmoothingType.BOXCAR, label: "Boxcar"},
            {value: SmoothingType.GAUSSIAN, label: "Gaussian"},
            {value: SmoothingType.HANNING, label: "Hanning"}
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
                {(widgetStore.smoothingType === SmoothingType.BOXCAR) &&
                <FormGroup label={"Kernel"} inline={true}>
                    <SafeNumericInput
                        value={widgetStore.smoothingBoxcarSize}
                        min={2}
                        step={1}
                        className="narrow"
                        onValueChange={val => widgetStore.setSmoothingBoxcarSize(Math.round(val))}
                    />
                </FormGroup>
                }
                {widgetStore.smoothingType === SmoothingType.GAUSSIAN &&
                <FormGroup label={"Sigma"} inline={true}>
                    <SafeNumericInput
                        value={widgetStore.smoothingGaussianSigma}
                        min={1}
                        className="narrow"
                        onValueChange={val => widgetStore.setSmoothingGaussianSigma(Number.parseFloat(val))}
                    />
                    {/* {Math.ceil(widgetStore.smoothingGaussianSigma * 2)}
                    {(Math.ceil(widgetStore.smoothingGaussianSigma * 2) - 1) / (2 * widgetStore.smoothingGaussianSigma)} */}
                </FormGroup>
                }
                {(widgetStore.smoothingType === SmoothingType.HANNING) &&
                <FormGroup label={"Kernel"} inline={true}>
                    <SafeNumericInput
                        value={widgetStore.smoothingHanningSize}
                        min={3}
                        step={1}
                        className="narrow"
                        onValueChange={val => widgetStore.setSmoothingHanningSize(Math.round(val))}
                    />
                </FormGroup>
                }
            </React.Fragment>
        );
    }
}