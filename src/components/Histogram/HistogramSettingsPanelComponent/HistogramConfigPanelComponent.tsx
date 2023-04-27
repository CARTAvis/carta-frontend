import * as React from "react";
import {Button, Divider, FormGroup, Intent, Slider, Switch} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {observer} from "mobx-react";

import {SafeNumericInput} from "components/Shared";
import {HistogramWidgetStore} from "stores/Widgets";

@observer
export class HistogramConfigPanelComponent extends React.Component<{widgetStore: HistogramWidgetStore}> {
    private static readonly BINS_LOWER_BOUND = 2;

    private currentMaxNumBins: number;
    private minPixIntent: Intent;
    private maxPixIntent: Intent;

    get widgetStore(): HistogramWidgetStore {
        return this.props.widgetStore;
    }

    get maxNumBins(): number {
        if (this.currentMaxNumBins !== undefined && this.currentMaxNumBins > HistogramConfigPanelComponent.BINS_LOWER_BOUND) {
            return this.currentMaxNumBins;
        }
        return this.widgetStore.maxNumBins;
    }

    get sliderLabelStepSize(): number {
        return this.widgetStore.maxNumBins > HistogramConfigPanelComponent.BINS_LOWER_BOUND ? this.widgetStore.maxNumBins - HistogramConfigPanelComponent.BINS_LOWER_BOUND : 0;
    }

    get sliderValue(): number {
        return this.widgetStore.currentNumBins <= this.widgetStore.maxNumBins ? this.widgetStore.currentNumBins : this.widgetStore.maxNumBins;
    }

    private onSetAutoBounds = (autoBounds: boolean) => {
        this.widgetStore.setAutoBounds(autoBounds);
        if (autoBounds) {
            this.minPixIntent = Intent.NONE;
            this.maxPixIntent = Intent.NONE;
        }
    };

    private onMinPixChanged = (minPix: number) => {
        this.widgetStore.setMinPix(minPix);

        if (minPix >= this.widgetStore.currentMaxPix) {
            this.minPixIntent = Intent.DANGER;
        } else {
            this.minPixIntent = Intent.NONE;
        }
        this.maxPixIntent = Intent.NONE;
    };

    private onMaxPixChanged = (maxPix: number) => {
        this.widgetStore.setMaxPix(maxPix);

        if (maxPix <= this.widgetStore.currentMinPix) {
            this.maxPixIntent = Intent.DANGER;
        } else {
            this.maxPixIntent = Intent.NONE;
        }
        this.minPixIntent = Intent.NONE;
    };

    private onSetAutoBins = (autoBin: boolean) => {
        this.widgetStore.setAutoBins(autoBin);
    };

    private onMaxNumBinsChanged = (currentMaxNumBins: number) => {
        this.currentMaxNumBins = currentMaxNumBins;
        this.widgetStore.setMaxNumBins(this.maxNumBins);
    };

    private changeNumBinsHandler = (numBins: number) => {
        this.widgetStore.setNumBins(numBins);
    };

    private onResetConfig = () => {
        this.widgetStore.onResetConfig();

        // Reset the maximum number of bins for the bins slider and its filler
        const newMaxNumBins = this.widgetStore.currentNumBins * 2;
        this.currentMaxNumBins = newMaxNumBins;
        this.widgetStore.setMaxNumBins(newMaxNumBins);

        // Reset the intent for min/max pixel filler
        this.minPixIntent = Intent.NONE;
        this.maxPixIntent = Intent.NONE;
    };

    render() {
        const errorMinPix = (
            <span>
                <i>
                    This value must be smaller then <strong>X max</strong>!
                </i>
            </span>
        );

        const errorMaxPix = (
            <span>
                <i>
                    This value must be greater then <strong>X min</strong>!
                </i>
            </span>
        );

        const setPixelBoundsPanel = (
            <React.Fragment>
                <FormGroup inline={true} label={"Auto pixel bounds"}>
                    <Switch
                        checked={this.widgetStore.currentAutoBounds}
                        onChange={event => {
                            const e = event.target as HTMLInputElement;
                            this.onSetAutoBounds(e.checked);
                        }}
                    />
                </FormGroup>
                {!this.widgetStore.currentAutoBounds && (
                    <div className="line-boundary">
                        <FormGroup label="X min" inline={true}>
                            <Tooltip2 content={errorMinPix} disabled={this.widgetStore.isAbleToGenerate} placement="top">
                                <SafeNumericInput intent={this.minPixIntent} value={this.widgetStore.currentMinPix} buttonPosition="none" onValueChange={val => this.onMinPixChanged(val)} />
                            </Tooltip2>
                        </FormGroup>
                        <FormGroup label="X max" inline={true}>
                            <Tooltip2 content={errorMaxPix} disabled={this.widgetStore.isAbleToGenerate} placement="bottom">
                                <SafeNumericInput intent={this.maxPixIntent} value={this.widgetStore.currentMaxPix} buttonPosition="none" onValueChange={val => this.onMaxPixChanged(val)} />
                            </Tooltip2>
                        </FormGroup>
                    </div>
                )}
            </React.Fragment>
        );

        const setNumBinsPanel = (
            <React.Fragment>
                <FormGroup inline={true} label={"Auto bins"}>
                    <Switch
                        checked={this.widgetStore.currentAutoBins}
                        onChange={event => {
                            const e = event.target as HTMLInputElement;
                            this.onSetAutoBins(e.checked);
                        }}
                    />
                </FormGroup>
                {!this.widgetStore.currentAutoBins && (
                    <div className="line-boundary">
                        <FormGroup label="Number of bins" inline={true}>
                            <Slider
                                min={HistogramConfigPanelComponent.BINS_LOWER_BOUND}
                                max={this.widgetStore.maxNumBins}
                                stepSize={1}
                                labelStepSize={this.sliderLabelStepSize}
                                onChange={this.changeNumBinsHandler}
                                value={this.sliderValue}
                                vertical={false}
                            />
                        </FormGroup>
                        <FormGroup label="Max number of bins" inline={true}>
                            <SafeNumericInput value={this.maxNumBins} buttonPosition="none" onValueChange={val => this.onMaxNumBinsChanged(val)} />
                        </FormGroup>
                    </div>
                )}
            </React.Fragment>
        );

        const resetConfigPanel = (
            <React.Fragment>
                <FormGroup label="Reset config" inline={true}>
                    <Button className="reset-range-content" icon={"zoom-to-fit"} small={true} disabled={this.widgetStore.currentAutoBounds && this.widgetStore.currentAutoBins} onClick={this.onResetConfig}>
                        Reset config
                    </Button>
                </FormGroup>
            </React.Fragment>
        );

        return (
            <div className="line-settings-panel">
                {setPixelBoundsPanel}
                <Divider />
                {setNumBinsPanel}
                <Divider />
                {resetConfigPanel}
            </div>
        );
    }
}
