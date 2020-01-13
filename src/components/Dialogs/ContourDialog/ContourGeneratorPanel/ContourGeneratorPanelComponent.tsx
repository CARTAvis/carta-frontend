import * as React from "react";
import {observer} from "mobx-react";
import {action, computed, observable} from "mobx";
import {Button, FormGroup, MenuItem, NumericInput, Tooltip} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {FrameStore} from "stores";
import {SCALING_POPOVER_PROPS} from "../../../RenderConfig/ColormapConfigComponent/ColormapConfigComponent";
import {getPercentiles} from "utilities";
import "./ContourGeneratorPanelComponent.css";

enum ContourGeneratorType {
    StartStepPower = "start-step-power-n",
    MinMaxNScaling = "min-max-n-scaling",
    PercentagesRefN = "percentages-ref.value-n",
}

const KEYCODE_ENTER = 13;

const GeneratorSelect = Select.ofType<ContourGeneratorType>();

@observer
export class ContourGeneratorPanelComponent extends React.Component<{ frame: FrameStore, onLevelsGenerated: (levels: number[]) => void }> {
    @observable generator: ContourGeneratorType = ContourGeneratorType.MinMaxNScaling;

    @observable enteredMinValue: number | undefined;
    @observable enteredMaxValue: number | undefined;
    @observable numLevels: number = 5;

    @computed get minValue() {
        if (this.enteredMinValue === undefined && this.props.frame && this.props.frame.renderConfig.contourHistogram) {
            return getPercentiles(this.props.frame.renderConfig.contourHistogram, [0.1])[0];
        } else {
            return this.enteredMinValue;
        }
    }

    @computed get maxValue() {
        if (this.enteredMaxValue === undefined && this.props.frame && this.props.frame.renderConfig.contourHistogram) {
            return getPercentiles(this.props.frame.renderConfig.contourHistogram, [99.9])[0];
        } else {
            return this.enteredMaxValue;
        }
    }

    @action setMinValue = (val: number) => {
        if (val !== this.minValue) {
            this.enteredMinValue = val;
        }
    };

    @action clearMinValue = () => {
        this.enteredMinValue = undefined;
    };

    @action setMaxValue = (val: number) => {
        if (val !== this.maxValue) {
            this.enteredMaxValue = val;
        }
    };

    @action clearMaxValue = () => {
        this.enteredMaxValue = undefined;
    };

    handleMinChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        if (isFinite(val) && val !== this.minValue) {
            this.enteredMinValue = val;
        }
    };

    handleMaxChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        if (isFinite(val) && val !== this.maxValue) {
            this.enteredMaxValue = val;
        }
    };

    private renderGeneratorSelectItem = (generator: ContourGeneratorType, {handleClick, modifiers, query}) => {
        return <MenuItem text={generator} onClick={handleClick} key={generator}/>;
    };

    private generateLevels = () => {
        const levels = [];

        // Return midpoint if only one level is selected
        if (this.numLevels <= 1) {
            levels.push((this.maxValue + this.minValue) / 2.0);
        } else {
            const range = this.maxValue - this.minValue;
            const interval = range / (this.numLevels - 1);
            for (let i = 0; i < this.numLevels; i++) {
                levels.push(this.minValue + interval * i);
            }
        }

        this.props.onLevelsGenerated(levels);
    };

    render() {
        const frame = this.props.frame;
        if (!frame) {
            return null;
        }

        return (
            <div className="contour-generator-panel">
                <div className="generator-select-row">
                    <FormGroup label="Generator" inline={true}>
                        <GeneratorSelect
                            activeItem={this.generator}
                            popoverProps={SCALING_POPOVER_PROPS}
                            filterable={false}
                            items={[ContourGeneratorType.StartStepPower, ContourGeneratorType.MinMaxNScaling, ContourGeneratorType.PercentagesRefN]}
                            onItemSelect={val => this.generator = val}
                            itemRenderer={this.renderGeneratorSelectItem}
                        >
                            <Button text={this.generator} rightIcon="double-caret-vertical" alignText={"right"}/>
                        </GeneratorSelect>
                    </FormGroup>
                    <Button intent="success" className="generate-button" onClick={this.generateLevels}>Generate</Button>
                </div>
                <div className="generator-parameters-row">
                    <FormGroup label="Min" inline={true}>
                        <NumericInput
                            value={this.minValue}
                            onBlur={this.handleMinChange}
                            onKeyDown={this.handleMinChange}
                            buttonPosition="none"
                            rightElement={
                                <Tooltip content="Reset value to default">
                                    <Button icon="refresh" minimal={true} onClick={this.clearMinValue}/>
                                </Tooltip>
                            }
                        />
                    </FormGroup>
                    <FormGroup label="Max" inline={true}>
                        <NumericInput
                            value={this.maxValue}
                            onBlur={this.handleMaxChange}
                            onKeyDown={this.handleMaxChange}
                            buttonPosition="none"
                            rightElement={
                                <Tooltip content="Reset value to default">
                                    <Button icon="refresh" minimal={true} onClick={this.clearMaxValue}/>
                                </Tooltip>
                            }
                        />
                    </FormGroup>
                    <FormGroup label="N" inline={true}>
                        <NumericInput
                            value={this.numLevels}
                            min={1}
                            max={20}
                            step={1}
                            onValueChange={val => this.numLevels = Math.floor(val)}
                        />
                    </FormGroup>
                </div>

            </div>
        );
    }
}