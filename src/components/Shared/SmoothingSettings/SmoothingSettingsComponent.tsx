import * as React from "react";
import {observer} from "mobx-react";
import {FormGroup, HTMLSelect, IOptionProps} from "@blueprintjs/core";
import {SpectralProfileWidgetStore} from "stores/widgets";

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
            {value: SmoothingType.GAUSSIAN, label: "Gaussian"}
        ];
        const kernelOptions: IOptionProps[] = [
            {value: 3, label: "3"},
            {value: 4, label: "4"},
            {value: 5, label: "5"},
            {value: 6, label: "6"},
            {value: 11, label: "11"},
            {value: 21, label: "21"},
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
                <FormGroup label={"Kernel"} inline={true} disabled={widgetStore.smoothingType === SmoothingType.NONE}>
                    <HTMLSelect
                        disabled={widgetStore.smoothingType === SmoothingType.NONE}
                        value={widgetStore && widgetStore.smoothingKernel ? widgetStore.smoothingKernel : 3}
                        options={kernelOptions}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => widgetStore.setSmoothingKernel(Number.parseInt(event.currentTarget.value))}
                    />
                </FormGroup>
            </React.Fragment>
        );
    }
}