import * as React from "react";
import {Button, Divider, FormGroup, Switch} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {observer} from "mobx-react";

import {SafeNumericInput} from "components/Shared";
import {HistogramWidgetStore} from "stores/Widgets";

import "./HistogramConfigPanelComponent.scss";

@observer
export class HistogramConfigPanelComponent extends React.Component<{widgetStore: HistogramWidgetStore}> {
    get widgetStore(): HistogramWidgetStore {
        return this.props.widgetStore;
    }

    private onSetAutoBounds = (autoBounds: boolean) => {
        this.widgetStore.setAutoBounds(autoBounds);
        this.updateConfigs();
    };

    private onMinPixChanged = (minPix: number) => {
        this.widgetStore.setMinPix(minPix);
        this.updateConfigs();
    };

    private onMaxPixChanged = (maxPix: number) => {
        this.widgetStore.setMaxPix(maxPix);
        this.updateConfigs();
    };

    private onSetAutoBins = (autoBin: boolean) => {
        this.widgetStore.setAutoBins(autoBin);
        this.updateConfigs();
    };

    private onNumBinsChanged = (numBins: number) => {
        this.widgetStore.setNumBins(numBins);
        this.updateConfigs();
    };

    private onResetConfig = () => {
        this.widgetStore.onResetConfig();
        this.updateConfigs();
    };

    private updateConfigs = () => {
        if (this.widgetStore.isAbleToGenerate) {
            this.widgetStore.updateConfigs();
        }
    };

    render() {
        const frame = this.widgetStore.effectiveFrame;

        const hint = (
            <span>
                <br />
                <i>
                    <small>
                        Please ensure:
                        <br />
                        1. The range of pixel bounds is from small to large.
                        <br />
                        2. The number of bins is greater than 0.
                    </small>
                </i>
            </span>
        );

        const errorMsg = <span className="crimson-text">Unable to generate histogram{hint}</span>;

        const resetButtonToolTip = <span>Reset histogram config with the same one for current channel image.</span>;

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
                    <FormGroup label="Range" inline={true} labelInfo={`(${frame && frame.requiredUnit ? frame.requiredUnit : "Unknown"})`}>
                        <div className="pixel-range-select">
                            <FormGroup label="From" inline={true}>
                                <SafeNumericInput value={this.widgetStore.curMinPix} buttonPosition="none" onValueChange={val => this.onMinPixChanged(val)} />
                            </FormGroup>
                            <FormGroup label="To" inline={true}>
                                <SafeNumericInput value={this.widgetStore.curMaxPix} buttonPosition="none" onValueChange={val => this.onMaxPixChanged(val)} />
                            </FormGroup>
                        </div>
                    </FormGroup>
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
                    <FormGroup label="Number of bins" inline={true}>
                        <div className="range-select">
                            <SafeNumericInput value={this.widgetStore.curNumBins} buttonPosition="none" onValueChange={val => this.onNumBinsChanged(val)} />
                        </div>
                    </FormGroup>
                )}
            </React.Fragment>
        );

        const resetConfigPanel = (
            <React.Fragment>
                <Tooltip2 content={resetButtonToolTip}>
                    <Button className="reset-config-button" icon={"zoom-to-fit"} small={true} onClick={this.onResetConfig}>
                        Reset config
                    </Button>
                </Tooltip2>
                <br />
                {!this.widgetStore.isAbleToGenerate && <div className="reset-generate">{errorMsg}</div>}
            </React.Fragment>
        );

        return (
            <div className="config-generator">
                <div className="config-panel">
                    {setPixelBoundsPanel}
                    <Divider />
                    {setNumBinsPanel}
                    <Divider />
                    {resetConfigPanel}
                </div>
            </div>
        );
    }
}
