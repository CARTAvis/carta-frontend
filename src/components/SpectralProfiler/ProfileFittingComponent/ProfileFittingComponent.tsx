import * as React from "react";
import {observer} from "mobx-react";
import {AnchorButton, FormGroup, HTMLSelect, Slider, Pre, Text, Intent} from "@blueprintjs/core";
import {SafeNumericInput} from "components/Shared";
import {ProfileFittingStore} from "stores/ProfileFittingStore"
import {AppStore} from "stores";
import "./ProfileFittingComponent.scss";

export enum FittingFunction {
    GAUSSIAN,
    LORENTZIAN
}

export enum FittingContinuum {
    NONE,
    ZEROTH_ORDER,
    FIRST_ORDER
}

@observer
export class ProfileFittingComponent extends React.Component<{fittingStore: ProfileFittingStore}> {


    private onCenterValueChanged = (val: number) => {
        this.props.fittingStore.selectedComponent.setCenter(val);
        this.drawSelectedComponent();
    }

    private onAmpValueChanged = (val: number) => {
        this.props.fittingStore.selectedComponent.setAmp(val);
        this.drawSelectedComponent();
    }

    private onFwhmValueChanged = (val: number) => {
        this.props.fittingStore.selectedComponent.setFwhm(val);
        this.drawSelectedComponent();
    }
    
    private drawSelectedComponent = () => {
        const component = this.props.fittingStore.selectedComponent;
        if (isFinite(component.center) && isFinite(component.amp) && isFinite(component.fwhm)) {

        }
    }

    private reset = () => {
        this.props.fittingStore.setComponents(1,true);
    }

    private fitData = () => {
    }

    private readyToFit = () => {
        for (let i = 0; i < this.props.fittingStore.components.length; i++) {
            if (!this.props.fittingStore.components[i].readyToFit) {
                return false;
            }
        }
        return true;
    }

    render() {
        const appStore = AppStore.Instance;
        const fittingStore = this.props.fittingStore;

        // dummy variables for triggering re-render
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const selectedCenter = fittingStore.selectedComponent.center;
        const selectedAmp = fittingStore.selectedComponent.amp;
        const selectedFwhm = fittingStore.selectedComponent.fwhm;
        /* eslint-disable @typescript-eslint/no-unused-vars */

        return (
            <div className="profile-fitting-panel">
                <div className="profile-fitting-form">
                    <FormGroup label="Data source" inline={true}>
                        <HTMLSelect 
                            value={appStore.activeFrameIndex} 
                            options={appStore.frameNames} 
                            onChange={(ev) => appStore.setActiveFrame(parseInt(ev.target.value))}
                        />
                    </FormGroup>
                    <FormGroup label="Profile function" inline={true}>
                        <HTMLSelect 
                            value={fittingStore.function} 
                            options={[{label:"Gaussian", value: FittingFunction.GAUSSIAN}, {label:"Lorentzian", value: FittingFunction.LORENTZIAN}]} 
                            onChange={(ev) => fittingStore.setFunction(parseInt(ev.target.value))}
                        />
                    </FormGroup>
                    <FormGroup label="N component" inline={true}>
                        <SafeNumericInput
                            value={fittingStore.components.length}
                            min={1}
                            max={10}
                            stepSize={1}
                            onValueChange={val => fittingStore.setComponents(Math.round(val))}
                        />
                    </FormGroup>
                    <FormGroup label="Continuum" inline={true}>
                        <HTMLSelect 
                            value={fittingStore.continuum} 
                            options={[{label:"None", value: FittingContinuum.NONE}, {label:"0th order", value: FittingContinuum.ZEROTH_ORDER}, {label:"1th order", value: FittingContinuum.FIRST_ORDER}]} 
                            onChange={(ev) => fittingStore.setContinuum(parseInt(ev.target.value))}
                        />
                    </FormGroup>
                    <FormGroup label="Component" inline={true}>
                        <div className="component-slider">
                            <Slider
                                value={fittingStore.selectedIndex + 1}
                                min={1}
                                stepSize={1}
                                max={fittingStore.components.length}
                                showTrackFill={false}
                                onChange={val => fittingStore.setSelectedIndex(val - 1)}
                                disabled={fittingStore.components.length <= 1}
                            />
                        </div>
                    </FormGroup>
                    <FormGroup inline={true}>
                        <FormGroup label="Cursor selection" inline={true}>
                            <AnchorButton disabled={true} active={true} icon="select"/>
                        </FormGroup>
                        <FormGroup label="Center" inline={true}>
                            <div className="component-input">
                                <SafeNumericInput
                                    value={fittingStore.selectedComponent.center}
                                    onValueChange={this.onCenterValueChanged}
                                    disabled={fittingStore.selectedComponent.lockedCenter}
                                    allowNumericCharactersOnly={false}
                                    buttonPosition="none"
                                />
                                <AnchorButton icon={fittingStore.selectedComponent.lockedCenter ? "lock" : "unlock"}/>
                            </div>
                        </FormGroup>
                        <FormGroup label="Amplitude" inline={true}>
                            <div className="component-input">
                                <SafeNumericInput
                                    value={fittingStore.selectedComponent.amp}
                                    onValueChange={this.onAmpValueChanged}
                                    disabled={fittingStore.selectedComponent.lockedAmp}
                                    allowNumericCharactersOnly={false}
                                    buttonPosition="none"
                                    />
                                <AnchorButton icon={fittingStore.selectedComponent.lockedAmp ? "lock" : "unlock"}/>
                            </div>
                        </FormGroup>
                        <FormGroup label="FWHM" inline={true}>
                            <div className="component-input">
                                <SafeNumericInput
                                    value={fittingStore.selectedComponent.fwhm}
                                    onValueChange={this.onFwhmValueChanged}
                                    disabled={fittingStore.selectedComponent.lockedFwhm}
                                    allowNumericCharactersOnly={false}
                                    buttonPosition="none"
                                />
                                <AnchorButton icon={fittingStore.selectedComponent.lockedFwhm ? "lock" : "unlock"}/>
                            </div>
                        </FormGroup>
                    </FormGroup>
                    <FormGroup label="Fitting result" inline={true}>
                        <Pre className="fitting-result-pre">
                            <Text>
                                {fittingStore.resultString}
                            </Text>
                        </Pre>
                    </FormGroup>              
                </div>
                <div className="profile-fitting-footer">
                    <AnchorButton
                        text="View log"
                        intent={Intent.PRIMARY}
                    />
                    <AnchorButton 
                        text="Save log"
                        intent={Intent.PRIMARY}
                    />
                    <AnchorButton 
                        text="Reset"
                        intent={Intent.PRIMARY}
                        onClick={this.reset}
                    />
                    <AnchorButton
                        text="Fit"
                        intent={Intent.PRIMARY}
                        onClick={this.fitData}
                        disabled={!this.readyToFit}
                    />
                </div>
            </div>
        );
    }
}
