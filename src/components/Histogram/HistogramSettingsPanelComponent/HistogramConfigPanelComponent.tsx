import * as React from "react";
import {Button, Divider, FormGroup, Intent, Slider, Switch, Tooltip} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {SafeNumericInput} from "components/Shared";
import {type HistogramWidgetStore} from "stores/Widgets";

@observer
export class HistogramConfigPanelComponent extends React.Component<{widgetStore: HistogramWidgetStore}> {
    private static readonly BinsLowerBound = 2;
    private shouldResetMaxNumBins: boolean;
    private minPixIntent: Intent;
    private maxPixIntent: Intent;

    get widgetStore(): HistogramWidgetStore {
        return this.props.widgetStore;
    }

    get sliderLabelStepSize(): number {
        return this.widgetStore.maxNumBins > HistogramConfigPanelComponent.BinsLowerBound ? this.widgetStore.maxNumBins - HistogramConfigPanelComponent.BinsLowerBound : 1;
    }

    get sliderValue(): number {
        const currentNumBins = this.widgetStore.currentNumBins ?? 0;
        const maxNumBins = this.widgetStore.maxNumBins;
        return currentNumBins <= maxNumBins ? currentNumBins : maxNumBins;
    }

    get sliderMaxValue(): number {
        if (this.shouldResetMaxNumBins) {
            const currentNumBins = this.widgetStore.currentNumBins ?? 0;
            this.widgetStore.setMaxNumBins(currentNumBins * 2);
            this.shouldResetMaxNumBins = false;
        }
        return this.widgetStore.maxNumBins;
    }

    private onSetAutoBounds = (isAutoBounds: boolean) => {
        this.widgetStore.setAutoBounds(isAutoBounds);
        if (isAutoBounds) {
            this.minPixIntent = Intent.NONE;
            this.maxPixIntent = Intent.NONE;
        }
    };

    private onMinPixChanged = (minPix: number) => {
        this.widgetStore.setMinPix(minPix);

        const currentMaxPix = this.widgetStore.currentMaxPix;
        if (currentMaxPix !== undefined && minPix >= currentMaxPix) {
            this.minPixIntent = Intent.DANGER;
        } else {
            this.minPixIntent = Intent.NONE;
        }
        this.maxPixIntent = Intent.NONE;
    };

    private onMaxPixChanged = (maxPix: number) => {
        this.widgetStore.setMaxPix(maxPix);

        const currentMinPix = this.widgetStore.currentMinPix;
        if (currentMinPix !== undefined && maxPix <= currentMinPix) {
            this.maxPixIntent = Intent.DANGER;
        } else {
            this.maxPixIntent = Intent.NONE;
        }
        this.minPixIntent = Intent.NONE;
    };

    private onSetAutoBins = (isAutoBin: boolean) => {
        this.widgetStore.setAutoBins(isAutoBin);
        this.shouldResetMaxNumBins = true;
    };

    private onMaxNumBinsChanged = (currentMaxNumBins: number) => {
        if (currentMaxNumBins > HistogramConfigPanelComponent.BinsLowerBound) {
            this.widgetStore.setMaxNumBins(currentMaxNumBins);
        }
    };

    private changeNumBinsHandler = (numBins: number) => {
        this.widgetStore.setNumBins(numBins);
    };

    private onResetConfig = () => {
        this.widgetStore.onResetConfig();
        this.shouldResetMaxNumBins = true;

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
                        checked={this.widgetStore.isCurrentAutoBounds}
                        onChange={event => {
                            const e = event.target as HTMLInputElement;
                            this.onSetAutoBounds(e.checked);
                        }}
                    />
                </FormGroup>
                {!this.widgetStore.isCurrentAutoBounds && (
                    <div className="line-boundary">
                        <FormGroup label="X min" inline={true}>
                            <Tooltip content={errorMinPix} disabled={this.widgetStore.isAbleToGenerate} placement="top">
                                <SafeNumericInput intent={this.minPixIntent} value={this.widgetStore.currentMinPix} buttonPosition="none" onValueChange={val => this.onMinPixChanged(val)} />
                            </Tooltip>
                        </FormGroup>
                        <FormGroup label="X max" inline={true}>
                            <Tooltip content={errorMaxPix} disabled={this.widgetStore.isAbleToGenerate} placement="bottom">
                                <SafeNumericInput intent={this.maxPixIntent} value={this.widgetStore.currentMaxPix} buttonPosition="none" onValueChange={val => this.onMaxPixChanged(val)} />
                            </Tooltip>
                        </FormGroup>
                    </div>
                )}
            </React.Fragment>
        );

        const setNumBinsPanel = (
            <React.Fragment>
                <FormGroup inline={true} label={"Auto bins"}>
                    <Switch
                        checked={this.widgetStore.isCurrentAutoBins}
                        onChange={event => {
                            const e = event.target as HTMLInputElement;
                            this.onSetAutoBins(e.checked);
                        }}
                    />
                </FormGroup>
                {!this.widgetStore.isCurrentAutoBins && (
                    <div className="line-boundary">
                        <FormGroup label="Number of bins" inline={true}>
                            <Slider
                                min={HistogramConfigPanelComponent.BinsLowerBound}
                                max={this.sliderMaxValue}
                                stepSize={1}
                                labelStepSize={this.sliderLabelStepSize}
                                onChange={this.changeNumBinsHandler}
                                value={this.sliderValue}
                                vertical={false}
                            />
                        </FormGroup>
                        <FormGroup label="Max number of bins" inline={true}>
                            <SafeNumericInput value={this.widgetStore.maxNumBins} buttonPosition="none" onValueChange={val => this.onMaxNumBinsChanged(val)} />
                        </FormGroup>
                    </div>
                )}
            </React.Fragment>
        );

        const resetConfigPanel = (
            <React.Fragment>
                <FormGroup label="Reset config" inline={true}>
                    <Button className="reset-range-content" icon={"zoom-to-fit"} small={true} disabled={this.widgetStore.isCurrentAutoBounds && this.widgetStore.isCurrentAutoBins} onClick={this.onResetConfig}>
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
