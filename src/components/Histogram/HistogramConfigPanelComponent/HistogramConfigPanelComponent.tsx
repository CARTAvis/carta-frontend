import * as React from "react";
import {Button, Divider, FormGroup, Slider, Switch} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {observer} from "mobx-react";

import {SafeNumericInput} from "components/Shared";
import {HistogramWidgetStore} from "stores/Widgets";

import "./HistogramConfigPanelComponent.scss";

@observer
export class HistogramConfigPanelComponent extends React.Component<{widgetStore: HistogramWidgetStore}> {
    private curMaxNumBins: number;
    private binsLowerBound: number;

    get widgetStore(): HistogramWidgetStore {
        return this.props.widgetStore;
    }

    get maxNumBins(): number {
        if (this.curMaxNumBins !== undefined && this.curMaxNumBins > this.binsLowerBound) {
            return this.curMaxNumBins;
        }
        return this.widgetStore.maxNumBins;
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
        this.widgetStore.resetNumBins();
        this.updateConfigs();
    };

    private onMaxNumBinsChanged = (curMaxNumBins: number) => {
        if (curMaxNumBins !== undefined && curMaxNumBins > 1) {
            this.curMaxNumBins = curMaxNumBins;
        }
    };

    private onSetMaxNumBins = () => {
        this.widgetStore.setMaxNumBins(this.maxNumBins);
    };

    private changeNumBinsHandler = (numBins: number) => {
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
        const errorMsg = <span className="crimson-text">The range of pixel bounds must be from small to large.</span>;

        const resetButtonToolTip = <span>Reset histogram config with the previous automatic pixel bounds and number of bins.</span>;

        const resetMaxNumBinsTip = (
            <span>
                <i>
                    <small>
                        Maximum number of bins on slider.
                        <br />
                        To change it, please fill the new number and press &lt;Enter&gt;.
                    </small>
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
                            <SafeNumericInput value={this.widgetStore.curMinPix} buttonPosition="none" onValueChange={val => this.onMinPixChanged(val)} />
                        </FormGroup>
                        <FormGroup label="X max" inline={true}>
                            <SafeNumericInput value={this.widgetStore.curMaxPix} buttonPosition="none" onValueChange={val => this.onMaxPixChanged(val)} />
                        </FormGroup>
                    </div>
                )}
                {!this.widgetStore.isAbleToGenerate && <div className="reset-generate">{errorMsg}</div>}
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
                    <div className="select-num-bins">
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
                        <FormGroup label="" inline={true}>
                            <Tooltip2 content={resetMaxNumBinsTip}>
                                <SafeNumericInput value={this.maxNumBins} buttonPosition="none" onValueChange={val => this.onMaxNumBinsChanged(val)} onKeyDown={this.onSetMaxNumBins} />
                            </Tooltip2>
                        </FormGroup>
                    </div>
                )}
            </React.Fragment>
        );

        const resetConfigPanel = (
            <React.Fragment>
                <Tooltip2 content={resetButtonToolTip}>
                    <Button className="reset-range-content" icon={"zoom-to-fit"} small={true} onClick={this.onResetConfig}>
                        Reset config
                    </Button>
                </Tooltip2>
            </React.Fragment>
        );

        return (
            <div className="line-settings-panel">
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
