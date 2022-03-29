import * as React from "react";
import {observer} from "mobx-react";
import {action, computed, makeObservable, observable} from "mobx";
import {Button, FormGroup, MenuItem, TagInput} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {ContourGeneratorType, FrameScaling, FrameStore} from "stores/Frame";
import {ScalingSelectComponent, ClearableNumericInputComponent, SCALING_POPOVER_PROPS, SafeNumericInput} from "components/Shared";
import {getPercentiles, scaleValue} from "utilities";
import "./ContourGeneratorPanelComponent.scss";

const GeneratorSelect = Select.ofType<ContourGeneratorType>();

@observer
export class ContourGeneratorPanelComponent extends React.Component<{
    frame: FrameStore;
    generatorType: ContourGeneratorType;
    onLevelsGenerated: (levels: number[]) => void;
}> {
    @observable generator: ContourGeneratorType = this.props.generatorType ? this.props.generatorType : ContourGeneratorType.StartStepMultiplier;

    @observable numLevels: number = 5;

    // region min-max-scaling
    @observable enteredMinValue: number | undefined;
    @observable enteredMaxValue: number | undefined;
    @observable scalingType: FrameScaling = FrameScaling.LINEAR;

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

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    private renderMinMaxParameterRow() {
        const frame = this.props.frame;
        if (!frame) {
            return null;
        }

        return (
            <div className="parameter-container">
                <div className="parameter-line">
                    <ClearableNumericInputComponent label="Min" value={this.minValue} onValueChanged={val => (this.enteredMinValue = val)} onValueCleared={() => (this.enteredMinValue = undefined)} displayExponential={true} />
                    <ClearableNumericInputComponent label="Max" value={this.maxValue} onValueChanged={val => (this.enteredMaxValue = val)} onValueCleared={() => (this.enteredMaxValue = undefined)} displayExponential={true} />
                </div>
                <div className="parameter-line">
                    <FormGroup label="N" inline={true}>
                        <SafeNumericInput value={this.numLevels} min={1} max={20} stepSize={1} className="narrow" onValueChange={val => (this.numLevels = Math.floor(val))} />
                    </FormGroup>
                    <FormGroup label="Scaling" inline={true}>
                        <ScalingSelectComponent selectedItem={this.scalingType} onItemSelect={val => (this.scalingType = val)} />
                    </FormGroup>
                </div>
            </div>
        );
    }

    private generateMinMaxLevels = (): number[] => {
        if (!isFinite(this.minValue) || !isFinite(this.maxValue) || !isFinite(this.numLevels)) {
            return [];
        } else if (this.numLevels <= 1) {
            return [(this.maxValue + this.minValue) / 2.0];
        } else {
            const range = this.maxValue - this.minValue;
            const numIntervals = this.numLevels - 1;
            const levels = [];
            for (let i = 0; i < this.numLevels; i++) {
                const fraction = scaleValue(i / numIntervals, this.scalingType);
                levels.push(this.minValue + range * fraction);
            }
            return levels;
        }
    };

    // endregion

    // region start-step-multiplier
    @observable enteredStartValue: number | undefined;
    @observable enteredStepValue: number | undefined;
    @observable multiplierValue: number = 1;

    @computed get startValue() {
        if (this.enteredStartValue === undefined && this.props.frame && this.props.frame.renderConfig.contourHistogram && this.props.frame.renderConfig.contourHistogram.stdDev > 0) {
            return this.props.frame.renderConfig.contourHistogram.mean + 5.0 * this.props.frame.renderConfig.contourHistogram.stdDev;
        } else {
            return this.enteredStartValue;
        }
    }

    @computed get stepValue() {
        if (this.enteredStepValue === undefined && this.props.frame && this.props.frame.renderConfig.contourHistogram && this.props.frame.renderConfig.contourHistogram.stdDev > 0) {
            return 4.0 * this.props.frame.renderConfig.contourHistogram.stdDev;
        } else {
            return this.enteredStepValue;
        }
    }

    private renderStartStepParameterRow() {
        const frame = this.props.frame;
        if (!frame) {
            return null;
        }

        return (
            <div className="parameter-container">
                <div className="parameter-line">
                    <ClearableNumericInputComponent label="Start" value={this.startValue} onValueChanged={val => (this.enteredStartValue = val)} onValueCleared={() => (this.enteredStartValue = undefined)} displayExponential={true} />
                    <ClearableNumericInputComponent label="Step" value={this.stepValue} onValueChanged={val => (this.enteredStepValue = val)} onValueCleared={() => (this.enteredStepValue = undefined)} displayExponential={true} />
                </div>
                <div className="parameter-line">
                    <FormGroup label="N" inline={true}>
                        <SafeNumericInput value={this.numLevels} min={1} max={20} stepSize={1} className="narrow" onValueChange={val => (this.numLevels = Math.floor(val))} />
                    </FormGroup>
                    <FormGroup label="Multiplier" inline={true}>
                        <SafeNumericInput value={this.multiplierValue} min={0.1} stepSize={1} className="narrow" onValueChange={val => (this.multiplierValue = val)} />
                    </FormGroup>
                </div>
            </div>
        );
    }

    private generateStartStepLevels = () => {
        if (!isFinite(this.startValue) || !isFinite(this.stepValue) || !isFinite(this.multiplierValue) || !isFinite(this.numLevels)) {
            return [];
        } else if (this.numLevels <= 1) {
            return [this.startValue];
        } else {
            let step = this.stepValue;
            let value = this.startValue;
            const levels = [];
            for (let i = 0; i < this.numLevels; i++) {
                levels.push(value);
                value += step;
                step *= this.multiplierValue;
            }
            return levels;
        }
    };

    // endregion

    // region percentages-ref
    @observable enteredRefValue: number | undefined;
    @observable lowerPercentage: number = 20;
    @observable upperPercentage: number = 100;

    @computed get refValue() {
        if (this.enteredRefValue === undefined && this.props.frame && this.props.frame.renderConfig.contourHistogram) {
            return getPercentiles(this.props.frame.renderConfig.contourHistogram, [99.9])[0];
        } else {
            return this.enteredRefValue;
        }
    }

    private renderPercentageRefParameterRow() {
        const frame = this.props.frame;
        if (!frame) {
            return null;
        }

        return (
            <div className="parameter-container">
                <div className="parameter-line">
                    <ClearableNumericInputComponent label="Reference" value={this.refValue} onValueChanged={val => (this.enteredRefValue = val)} onValueCleared={() => (this.enteredRefValue = undefined)} displayExponential={true} />
                    <FormGroup label="N" inline={true}>
                        <SafeNumericInput value={this.numLevels} min={1} max={20} stepSize={1} className="narrow" onValueChange={val => (this.numLevels = Math.floor(val))} />
                    </FormGroup>
                </div>
                <div className="parameter-line">
                    <FormGroup label="Upper (%)" inline={true}>
                        <SafeNumericInput value={this.upperPercentage} min={0} max={100} stepSize={1} className="narrow" onValueChange={val => (this.upperPercentage = val)} />
                    </FormGroup>
                    <FormGroup label="Lower (%)" inline={true}>
                        <SafeNumericInput value={this.lowerPercentage} min={0} max={100} stepSize={1} className="narrow" onValueChange={val => (this.lowerPercentage = val)} />
                    </FormGroup>
                </div>
            </div>
        );
    }

    private generatePercentageRefLevels = () => {
        if (!isFinite(this.upperPercentage) || !isFinite(this.lowerPercentage) || !isFinite(this.refValue) || !isFinite(this.numLevels)) {
            return [];
        } else if (this.numLevels <= 1) {
            return [this.refValue];
        } else {
            const range = this.upperPercentage - this.lowerPercentage;
            const numIntervals = this.numLevels - 1;
            const interval = range / numIntervals;
            const levels = [];
            for (let i = 0; i < this.numLevels; i++) {
                levels.push((this.refValue * (this.lowerPercentage + interval * i)) / 100.0);
            }
            return levels;
        }
    };

    // endregion

    // region mean-sigma-list
    @observable enteredMeanValue: number | undefined;
    @observable enteredSigmaValue: number | undefined;
    @observable sigmaLevels: number[] = [-5, 5, 9, 13, 17];

    @computed get meanValue() {
        if (this.enteredMeanValue === undefined && this.props.frame && this.props.frame.renderConfig.contourHistogram && this.props.frame.renderConfig.contourHistogram.stdDev > 0) {
            return this.props.frame.renderConfig.contourHistogram.mean;
        } else {
            return this.enteredMeanValue;
        }
    }

    @computed get sigmaValue() {
        if (this.enteredSigmaValue === undefined && this.props.frame && this.props.frame.renderConfig.contourHistogram && this.props.frame.renderConfig.contourHistogram.stdDev > 0) {
            return this.props.frame.renderConfig.contourHistogram.stdDev;
        } else {
            return this.enteredSigmaValue;
        }
    }

    @action private handleLevelAdded = (values: string[]) => {
        try {
            for (const valueString of values) {
                const val = parseFloat(valueString);
                if (isFinite(val)) {
                    this.sigmaLevels.push(val);
                }
            }
        } catch (e) {
            console.log(e);
        }
    };

    @action private handleLevelRemoved = (value: string, index: number) => {
        this.sigmaLevels = this.sigmaLevels.filter((v, i) => i !== index);
    };

    private renderMeanSigmaParameterRow() {
        const frame = this.props.frame;
        if (!frame) {
            return null;
        }

        return (
            <div className="parameter-container">
                <div className="parameter-line">
                    <ClearableNumericInputComponent label="Mean" value={this.meanValue} onValueChanged={val => (this.enteredMeanValue = val)} onValueCleared={() => (this.enteredMeanValue = undefined)} displayExponential={true} />
                    <ClearableNumericInputComponent label="Sigma" value={this.sigmaValue} onValueChanged={val => (this.enteredSigmaValue = val)} onValueCleared={() => (this.enteredSigmaValue = undefined)} displayExponential={true} />
                </div>
                <div className="parameter-line">
                    <FormGroup label={"Sigma List"} inline={true}>
                        <TagInput
                            addOnBlur={true}
                            fill={true}
                            tagProps={{
                                minimal: true
                            }}
                            onAdd={this.handleLevelAdded}
                            onRemove={this.handleLevelRemoved}
                            values={this.sigmaLevels.map(v => v.toString())}
                        />
                    </FormGroup>
                </div>
            </div>
        );
    }

    private generateMeanSigmaLevels = () => {
        return this.sigmaLevels.map(level => this.meanValue + this.sigmaValue * level).filter(level => isFinite(level));
    };

    // endregion

    private renderGeneratorSelectItem = (generator: ContourGeneratorType, {handleClick, modifiers, query}) => {
        return <MenuItem text={generator} onClick={handleClick} key={generator} />;
    };

    private generateLevels = () => {
        switch (this.generator) {
            case ContourGeneratorType.MinMaxNScaling:
                this.props.onLevelsGenerated(this.generateMinMaxLevels());
                break;
            case ContourGeneratorType.StartStepMultiplier:
                this.props.onLevelsGenerated(this.generateStartStepLevels());
                break;
            case ContourGeneratorType.PercentagesRefValue:
                this.props.onLevelsGenerated(this.generatePercentageRefLevels());
                break;
            case ContourGeneratorType.MeanSigmaList:
                this.props.onLevelsGenerated(this.generateMeanSigmaLevels());
                break;
            default:
                break;
        }
    };

    render() {
        const frame = this.props.frame;
        if (!frame) {
            return null;
        }

        let generatorParameters: React.ReactNode;

        switch (this.generator) {
            case ContourGeneratorType.MinMaxNScaling:
                generatorParameters = this.renderMinMaxParameterRow();
                break;
            case ContourGeneratorType.StartStepMultiplier:
                generatorParameters = this.renderStartStepParameterRow();
                break;
            case ContourGeneratorType.PercentagesRefValue:
                generatorParameters = this.renderPercentageRefParameterRow();
                break;
            case ContourGeneratorType.MeanSigmaList:
                generatorParameters = this.renderMeanSigmaParameterRow();
                break;
            default:
                break;
        }

        return (
            <div className="contour-generator-panel">
                <div className="generator-select-row">
                    <FormGroup label="Generator" inline={true}>
                        <GeneratorSelect
                            activeItem={this.generator}
                            popoverProps={SCALING_POPOVER_PROPS}
                            filterable={false}
                            items={[ContourGeneratorType.StartStepMultiplier, ContourGeneratorType.MinMaxNScaling, ContourGeneratorType.PercentagesRefValue, ContourGeneratorType.MeanSigmaList]}
                            onItemSelect={val => (this.generator = val)}
                            itemRenderer={this.renderGeneratorSelectItem}
                        >
                            <Button text={this.generator} rightIcon="double-caret-vertical" alignText={"right"} />
                        </GeneratorSelect>
                    </FormGroup>
                    <Button intent="success" className="generate-button" onClick={this.generateLevels}>
                        Generate
                    </Button>
                </div>
                <div className="generator-parameters-row">
                    <FormGroup label="Parameters" inline={true}>
                        {generatorParameters}
                    </FormGroup>
                </div>
            </div>
        );
    }
}
