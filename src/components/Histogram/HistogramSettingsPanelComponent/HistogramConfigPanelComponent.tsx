import * as React from "react";
import {Button, Divider, FormGroup, Intent, Slider, Switch} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {observer} from "mobx-react";

import {SafeNumericInput} from "components/Shared";
import {HistogramWidgetStore} from "stores/Widgets";

@observer
export class HistogramConfigPanelComponent extends React.Component<{widgetStore: HistogramWidgetStore}> {
    private currentMaxNumBins: number;
    private binsLowerBound: number;
    private minPixIntent: Intent;
    private maxPixIntent: Intent;

    get widgetStore(): HistogramWidgetStore {
        return this.props.widgetStore;
    }

    get maxNumBins(): number {
        if (this.currentMaxNumBins !== undefined && this.currentMaxNumBins > this.binsLowerBound) {
            return this.currentMaxNumBins;
        }
        return this.widgetStore.maxNumBins;
    }

    private onSetAutoBounds = (autoBounds: boolean) => {
        this.widgetStore.setAutoBounds(autoBounds);
        this.updateConfigs();
    };

    private onMinPixChanged = (minPix: number) => {
        this.widgetStore.setMinPix(minPix);

        if (minPix >= this.widgetStore.curMaxPix) {
            this.minPixIntent = Intent.DANGER;
        } else {
            this.minPixIntent = Intent.NONE;
            this.updateConfigs();
        }
        this.maxPixIntent = Intent.NONE;
    };

    private onMaxPixChanged = (maxPix: number) => {
        this.widgetStore.setMaxPix(maxPix);

        if (maxPix <= this.widgetStore.curMinPix) {
            this.maxPixIntent = Intent.DANGER;
        } else {
            this.maxPixIntent = Intent.NONE;
            this.updateConfigs();
        }
        this.minPixIntent = Intent.NONE;
    };

    private onSetAutoBins = (autoBin: boolean) => {
        this.widgetStore.setAutoBins(autoBin);
        this.widgetStore.resetNumBins();
        this.updateConfigs();
    };

    private onMaxNumBinsChanged = (currentMaxNumBins: number) => {
        this.currentMaxNumBins = currentMaxNumBins;
        this.widgetStore.setMaxNumBins(this.maxNumBins);
    };

    private changeNumBinsHandler = (numBins: number) => {
        this.widgetStore.setNumBins(numBins);
        this.updateConfigs();
    };

    private onResetConfig = () => {
        this.widgetStore.onResetConfig();
        this.updateConfigs();

        // Reset the maximum number of bins for the bins slider and its filler
        const newMaxNumBins = this.widgetStore.curNumBins * 2;
        this.currentMaxNumBins = newMaxNumBins;
        this.widgetStore.setMaxNumBins(newMaxNumBins);

        // Reset the intent for min/max pixel filler
        this.minPixIntent = Intent.NONE;
        this.maxPixIntent = Intent.NONE;
    };

    private updateConfigs = () => {
        if (this.widgetStore.isAbleToGenerate) {
            this.widgetStore.updateConfigs();
        }
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

        const resetButtonToolTip = (
            <span>
                <i>
                    <small>Reset histogram config with the previous automatic pixel bounds and number of bins.</small>
                </i>
            </span>
        );

        this.binsLowerBound = 2;

        const setPixelBoundsPanel = (
            <React.Fragment>
                <FormGroup inline={true} label={"Auto pixel bounds"}>
                    <Switch
                        checked={this.widgetStore.isAutoBounds}
                        onChange={event => {
                            const e = event.target as HTMLInputElement;
                            this.onSetAutoBounds(e.checked);
                        }}
                    />
                </FormGroup>
                {!this.widgetStore.isAutoBounds && (
                    <div className="line-boundary">
                        <FormGroup label="X min" inline={true}>
                            <Tooltip2 content={errorMinPix} disabled={this.widgetStore.isAbleToGenerate} placement="top">
                                <SafeNumericInput intent={this.minPixIntent} value={this.widgetStore.curMinPix} buttonPosition="none" onValueChange={val => this.onMinPixChanged(val)} />
                            </Tooltip2>
                        </FormGroup>
                        <FormGroup label="X max" inline={true}>
                            <Tooltip2 content={errorMaxPix} disabled={this.widgetStore.isAbleToGenerate} placement="bottom">
                                <SafeNumericInput intent={this.maxPixIntent} value={this.widgetStore.curMaxPix} buttonPosition="none" onValueChange={val => this.onMaxPixChanged(val)} />
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
                        checked={this.widgetStore.isAutoBins}
                        onChange={event => {
                            const e = event.target as HTMLInputElement;
                            this.onSetAutoBins(e.checked);
                        }}
                    />
                </FormGroup>
                {!this.widgetStore.isAutoBins && (
                    <div className="line-boundary">
                        <FormGroup label="Number of bins" inline={true}>
                            <Slider
                                min={this.binsLowerBound}
                                max={this.widgetStore.maxNumBins}
                                stepSize={1}
                                labelStepSize={this.widgetStore.maxNumBins > this.binsLowerBound ? this.widgetStore.maxNumBins - this.binsLowerBound : 0}
                                onChange={this.changeNumBinsHandler}
                                value={this.widgetStore.curNumBins <= this.widgetStore.maxNumBins ? this.widgetStore.curNumBins : this.widgetStore.maxNumBins}
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
                <Tooltip2 content={resetButtonToolTip} placement="bottom">
                    <Button className="reset-range-content" icon={"zoom-to-fit"} small={true} onClick={this.onResetConfig}>
                        Reset config
                    </Button>
                </Tooltip2>
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
