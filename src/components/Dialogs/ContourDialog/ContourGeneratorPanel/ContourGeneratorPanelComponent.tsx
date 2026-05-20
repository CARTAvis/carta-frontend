import * as React from "react";
import {Button, FormGroup, MenuItem, TagInput} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {action, makeObservable, observable, runInAction} from "mobx";
import {observer} from "mobx-react";

import {ClearableNumericInputComponent, SafeNumericInput, SCALING_POPOVER_PROPS, ScalingSelectComponent} from "components/Shared";
import {ContourGeneratorType, FrameScaling} from "enums";
import {type FrameStore, PreferenceStore} from "stores";
import {getPercentiles, scaleValue} from "utilities";

import "./ContourGeneratorPanelComponent.scss";

// eslint-disable-next-line @typescript-eslint/naming-convention
const GeneratorSelect = Select<ContourGeneratorType>;

@observer
export class ContourGeneratorPanelComponent extends React.Component<{
    frame: FrameStore;
    generatorType: ContourGeneratorType;
    onLevelsGenerated: (levels: number[]) => void;
}> {
    @observable generator: ContourGeneratorType = this.props.generatorType ? this.props.generatorType : ContourGeneratorType.StartStepMultiplier;

    @observable numLevels: number = PreferenceStore.Instance.contourNumLevels;

    // region min-max-scaling
    @observable enteredMinValue: number | undefined = undefined;
    @observable enteredMaxValue: number | undefined = undefined;
    @observable scalingType: FrameScaling = FrameScaling.LINEAR;

    get minValue(): number {
        if (this.enteredMinValue === undefined && this.props.frame?.renderConfig?.contourHistogram) {
            return getPercentiles(this.props.frame.renderConfig.contourHistogram, [0.1])[0];
        } else {
            return this.enteredMinValue ?? 0;
        }
    }

    get maxValue(): number {
        if (this.enteredMaxValue === undefined && this.props.frame?.renderConfig?.contourHistogram) {
            return getPercentiles(this.props.frame.renderConfig.contourHistogram, [99.9])[0];
        } else {
            return this.enteredMaxValue ?? 1;
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
                    <ClearableNumericInputComponent
                        label="Min"
                        value={this.minValue}
                        onValueChanged={val => runInAction(() => (this.enteredMinValue = val))}
                        onValueCleared={() => runInAction(() => (this.enteredMinValue = undefined))}
                        displayExponential={true}
                    />
                    <ClearableNumericInputComponent
                        label="Max"
                        value={this.maxValue}
                        onValueChanged={val => runInAction(() => (this.enteredMaxValue = val))}
                        onValueCleared={() => runInAction(() => (this.enteredMaxValue = undefined))}
                        displayExponential={true}
                    />
                </div>
                <div className="parameter-line">
                    <FormGroup label="N" inline={true}>
                        <SafeNumericInput value={this.numLevels} min={1} max={20} stepSize={1} className="narrow" onValueChange={val => runInAction(() => (this.numLevels = Math.floor(val)))} />
                    </FormGroup>
                    <FormGroup label="Scaling" inline={true}>
                        <ScalingSelectComponent selectedItem={this.scalingType} onItemSelect={val => runInAction(() => (this.scalingType = val))} />
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
            const levels: number[] = [];
            for (let i = 0; i < this.numLevels; i++) {
                const fraction = scaleValue(i / numIntervals, this.scalingType);
                levels.push(this.minValue + range * fraction);
            }
            return levels;
        }
    };

    // endregion

    // region start-step-multiplier
    @observable enteredStartValue: number | undefined = undefined;
    @observable enteredStepValue: number | undefined = undefined;
    @observable multiplierValue: number = 1;

    get startValue(): number {
        const contourHistogram = this.props.frame.renderConfig.contourHistogram;
        if (this.enteredStartValue === undefined && contourHistogram?.mean && contourHistogram?.stdDev && contourHistogram?.stdDev > 0) {
            return contourHistogram.mean + 5.0 * contourHistogram.stdDev;
        } else {
            return this.enteredStartValue ?? 0;
        }
    }

    get stepValue(): number {
        const contourHistogram = this.props.frame.renderConfig.contourHistogram;
        if (this.enteredStepValue === undefined && contourHistogram?.stdDev && contourHistogram?.stdDev > 0) {
            return 4.0 * contourHistogram.stdDev;
        } else {
            return this.enteredStepValue ?? 1;
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
                    <ClearableNumericInputComponent
                        label="Start"
                        value={this.startValue}
                        onValueChanged={val => runInAction(() => (this.enteredStartValue = val))}
                        onValueCleared={() => runInAction(() => (this.enteredStartValue = undefined))}
                        displayExponential={true}
                    />
                    <ClearableNumericInputComponent
                        label="Step"
                        value={this.stepValue}
                        onValueChanged={val => runInAction(() => (this.enteredStepValue = val))}
                        onValueCleared={() => runInAction(() => (this.enteredStepValue = undefined))}
                        displayExponential={true}
                    />
                </div>
                <div className="parameter-line">
                    <FormGroup label="N" inline={true}>
                        <SafeNumericInput value={this.numLevels} min={1} max={20} stepSize={1} className="narrow" onValueChange={val => runInAction(() => (this.numLevels = Math.floor(val)))} />
                    </FormGroup>
                    <FormGroup label="Multiplier" inline={true}>
                        <SafeNumericInput value={this.multiplierValue} min={0.1} stepSize={1} className="narrow" onValueChange={val => runInAction(() => (this.multiplierValue = val))} />
                    </FormGroup>
                </div>
            </div>
        );
    }

    private generateStartStepLevels = (): number[] => {
        if (!isFinite(this.startValue) || !isFinite(this.stepValue) || !isFinite(this.multiplierValue) || !isFinite(this.numLevels)) {
            return [];
        } else if (this.numLevels <= 1) {
            return [this.startValue];
        } else {
            let step = this.stepValue;
            let value = this.startValue;
            const levels: number[] = [];
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
    @observable enteredRefValue: number | undefined = undefined;
    @observable lowerPercentage: number = 20;
    @observable upperPercentage: number = 100;

    get refValue(): number {
        if (this.enteredRefValue === undefined && this.props.frame?.renderConfig?.contourHistogram) {
            return getPercentiles(this.props.frame.renderConfig.contourHistogram, [99.9])[0];
        } else {
            return this.enteredRefValue ?? 1;
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
                    <ClearableNumericInputComponent
                        label="Reference"
                        value={this.refValue}
                        onValueChanged={val => runInAction(() => (this.enteredRefValue = val))}
                        onValueCleared={() => runInAction(() => (this.enteredRefValue = undefined))}
                        displayExponential={true}
                    />
                    <FormGroup label="N" inline={true}>
                        <SafeNumericInput value={this.numLevels} min={1} max={20} stepSize={1} className="narrow" onValueChange={val => runInAction(() => (this.numLevels = Math.floor(val)))} />
                    </FormGroup>
                </div>
                <div className="parameter-line">
                    <FormGroup label="Upper (%)" inline={true}>
                        <SafeNumericInput value={this.upperPercentage} min={0} max={100} stepSize={1} className="narrow" onValueChange={val => runInAction(() => (this.upperPercentage = val))} />
                    </FormGroup>
                    <FormGroup label="Lower (%)" inline={true}>
                        <SafeNumericInput value={this.lowerPercentage} min={0} max={100} stepSize={1} className="narrow" onValueChange={val => runInAction(() => (this.lowerPercentage = val))} />
                    </FormGroup>
                </div>
            </div>
        );
    }

    private generatePercentageRefLevels = (): number[] => {
        if (!isFinite(this.upperPercentage) || !isFinite(this.lowerPercentage) || !isFinite(this.refValue) || !isFinite(this.numLevels)) {
            return [];
        } else if (this.numLevels <= 1) {
            return [this.refValue];
        } else {
            const range = this.upperPercentage - this.lowerPercentage;
            const numIntervals = this.numLevels - 1;
            const interval = range / numIntervals;
            const levels: number[] = [];
            for (let i = 0; i < this.numLevels; i++) {
                levels.push((this.refValue * (this.lowerPercentage + interval * i)) / 100.0);
            }
            return levels;
        }
    };

    // endregion

    // region mean-sigma-list
    @observable enteredMeanValue: number | undefined = undefined;
    @observable enteredSigmaValue: number | undefined = undefined;
    @observable sigmaLevels: number[] = [-5, 5, 9, 13, 17];

    get meanValue(): number {
        const contourHistogram = this.props.frame.renderConfig.contourHistogram;
        if (this.enteredMeanValue === undefined && contourHistogram?.stdDev && contourHistogram?.stdDev > 0) {
            return contourHistogram.mean ?? NaN;
        } else {
            return this.enteredMeanValue ?? NaN;
        }
    }

    get sigmaValue(): number {
        const contourHistogram = this.props.frame.renderConfig.contourHistogram;
        if (this.enteredSigmaValue === undefined && contourHistogram?.stdDev && contourHistogram?.stdDev > 0) {
            return contourHistogram.stdDev;
        } else {
            return this.enteredSigmaValue ?? NaN;
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
                    <ClearableNumericInputComponent
                        label="Mean"
                        value={this.meanValue}
                        onValueChanged={val => runInAction(() => (this.enteredMeanValue = val))}
                        onValueCleared={() => runInAction(() => (this.enteredMeanValue = undefined))}
                        displayExponential={true}
                    />
                    <ClearableNumericInputComponent
                        label="Sigma"
                        value={this.sigmaValue}
                        onValueChanged={val => runInAction(() => (this.enteredSigmaValue = val))}
                        onValueCleared={() => runInAction(() => (this.enteredSigmaValue = undefined))}
                        displayExponential={true}
                    />
                </div>
                <div className="parameter-line">
                    <FormGroup label={"Sigma list"} inline={true}>
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

    private generateMeanSigmaLevels = (): number[] => {
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
                            <Button text={this.generator} endIcon="double-caret-vertical" alignText={"right"} />
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
