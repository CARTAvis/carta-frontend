import * as React from "react";
import {Button, Divider, FormGroup, Switch} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {observer} from "mobx-react";

import {SafeNumericInput} from "components/Shared";
import {HistogramWidgetStore} from "stores/Widgets";

import "./HistogramConfigPanelComponent.scss";

@observer
export class HistogramConfigPanelComponent extends React.Component<{widgetStore: HistogramWidgetStore}> {
    private onSetAutoBounds = (autoBounds: boolean) => {
        const widgetStore = this.props.widgetStore;
        widgetStore.setAutoBounds(autoBounds);
        this.updateConfigs();
    };

    private onMinPixChanged = (minPix: number) => {
        const widgetStore = this.props.widgetStore;
        widgetStore.setMinPix(minPix);
        this.updateConfigs();
    };

    private onMaxPixChanged = (maxPix: number) => {
        const widgetStore = this.props.widgetStore;
        widgetStore.setMaxPix(maxPix);
        this.updateConfigs();
    };

    private onSetAutoBins = (autoBin: boolean) => {
        const widgetStore = this.props.widgetStore;
        widgetStore.setAutoBins(autoBin);
        this.updateConfigs();
    };

    private onNumBinsChanged = (numBins: number) => {
        const widgetStore = this.props.widgetStore;
        widgetStore.setNumBins(numBins);
        this.updateConfigs();
    };

    private onResetConfig = () => {
        const widgetStore = this.props.widgetStore;
        widgetStore.onResetConfig();
        this.updateConfigs();
    };

    private updateConfigs = () => {
        const widgetStore = this.props.widgetStore;
        if (widgetStore.isAbleToGenerate) {
            widgetStore.updateConfigs();
        }
    };

    render() {
        const widgetStore = this.props.widgetStore;
        const frame = widgetStore.effectiveFrame;

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

        const msg = <span>Unable to generate histogram{hint}</span>;

        const buttonToolTip = <span>Reset histogram config to the same with that for current channel image.</span>;

        const configPanel = (
            <React.Fragment>
                <FormGroup inline={true} label={"Auto pixel bounds"}>
                    <Switch
                        checked={widgetStore.isAutoBounds}
                        onChange={event => {
                            const e = event.target as HTMLInputElement;
                            this.onSetAutoBounds(e.checked);
                        }}
                    />
                </FormGroup>
                {!widgetStore.isAutoBounds && (
                    <FormGroup label="Range" inline={true} labelInfo={`(${frame && frame.requiredUnit ? frame.requiredUnit : "Unknown"})`}>
                        <div className="range-select">
                            <FormGroup label="From" inline={true}>
                                <SafeNumericInput value={widgetStore.curMinPix} buttonPosition="none" onValueChange={val => this.onMinPixChanged(val)} />
                            </FormGroup>
                            <FormGroup label="To" inline={true}>
                                <SafeNumericInput value={widgetStore.curMaxPix} buttonPosition="none" onValueChange={val => this.onMaxPixChanged(val)} />
                            </FormGroup>
                        </div>
                    </FormGroup>
                )}
                <Divider />
                <FormGroup inline={true} label={"Auto bins"}>
                    <Switch
                        checked={widgetStore.isAutoBins}
                        onChange={event => {
                            const e = event.target as HTMLInputElement;
                            this.onSetAutoBins(e.checked);
                        }}
                    />
                </FormGroup>
                {!widgetStore.isAutoBins && (
                    <FormGroup label="Number of bins" inline={true}>
                        <SafeNumericInput value={widgetStore.curNumBins} buttonPosition="none" onValueChange={val => this.onNumBinsChanged(val)} />
                    </FormGroup>
                )}
                <Divider />
                <div className="config-generate">
                    <FormGroup inline={true} className="config-generate">
                        <Tooltip2 content={buttonToolTip}>
                            <Button className="reset-range-button" icon={"zoom-to-fit"} small={true} onClick={this.onResetConfig}>
                                Reset config
                            </Button>
                        </Tooltip2>
                    </FormGroup>
                    <br />
                    {!widgetStore.isAbleToGenerate && <div className="config-generate">{msg}</div>}
                </div>
            </React.Fragment>
        );

        return (
            <div className="config-generator">
                <div className="config-panel">{configPanel}</div>
            </div>
        );
    }
}
