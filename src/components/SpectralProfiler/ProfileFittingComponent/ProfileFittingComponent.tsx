import * as React from "react";
import {computed} from "mobx"
import {observer} from "mobx-react";
import {AnchorButton, FormGroup, HTMLSelect, Slider, Pre, Text, Intent} from "@blueprintjs/core";
import {SafeNumericInput} from "components/Shared";
import {ProfileFittingStore} from "stores/ProfileFittingStore"
import {SpectralProfileWidgetStore} from "stores/widgets/SpectralProfileWidgetStore";
import {AppStore, SpectralProfileStore} from "stores";
import {ProcessedSpectralProfile} from "models";
import {CARTA} from "carta-protobuf";
import "./ProfileFittingComponent.scss";
import { autoDetecting } from "utilities/fitting_heuristics";

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
export class ProfileFittingComponent extends React.Component<{fittingStore: ProfileFittingStore, widgetStore: SpectralProfileWidgetStore}> {


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

    private autoDetect = () => {
        this.reset();
        const guessComponents = autoDetecting(this.props.widgetStore.effectiveFrame.channelValues, Array.prototype.slice.call(this.coordinateData.values));
        if (guessComponents && guessComponents.length > 0) {
            this.props.fittingStore.setComponents(guessComponents.length);
            for (let i = 0; i < guessComponents.length; i++) {
                this.props.fittingStore.components[i].setAmp(guessComponents[i].amp);
                this.props.fittingStore.components[i].setCenter(guessComponents[i].center);
                this.props.fittingStore.components[i].setFwhm(guessComponents[i].fwhm);
            }
        }

    }

    private cursorSelecting = () => {
        this.props.fittingStore.setIsCursorSelectionOn(true);
    }

    private showLog = () => {}

    private reset = () => {
        this.props.fittingStore.setComponents(1,true);
        this.props.fittingStore.setHasResult(false);
    }

    private fitData = () => {
        if (this.props.fittingStore.readyToFit) {
            this.props.fittingStore.fitData(this.props.widgetStore.effectiveFrame.channelValues, this.coordinateData.values)
        }
    }

    private readyToFit = () => {
        for (let i = 0; i < this.props.fittingStore.components.length; i++) {
            if (!this.props.fittingStore.components[i].isReadyToFit) {
                return false;
            }
        }
        return true;
    }

    @computed get profileStore(): SpectralProfileStore {
        if (this.props.widgetStore.effectiveFrame) {
            let fileId = this.props.widgetStore.effectiveFrame.frameInfo.fileId;
            const regionId = this.props.widgetStore.effectiveRegionId;
            const frameMap = AppStore.Instance.spectralProfiles.get(fileId);
            if (frameMap) {
                return frameMap.get(regionId);
            }
        }
        return null;
    }

    @computed get coordinateData(): ProcessedSpectralProfile {
        const frame = this.props.widgetStore.effectiveFrame;
        if (!frame) {
            return null;
        }

        let regionId = this.props.widgetStore.effectiveRegionId;
        if (frame.regionSet) {
            const region = frame.regionSet.regions.find(r => r.regionId === regionId);
            if (region && this.profileStore) {
                return this.profileStore.getProfile(this.props.widgetStore.coordinate, region.isClosedRegion ? this.props.widgetStore.statsType : CARTA.StatsType.Sum);
            }
        }

        return null;
    }

    render() {
        const appStore = AppStore.Instance;
        const fittingStore = this.props.fittingStore;

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
                    <FormGroup label="Continuum" inline={true}>
                        <HTMLSelect 
                            value={fittingStore.continuum} 
                            options={[{label:"None", value: FittingContinuum.NONE}, {label:"0th order", value: FittingContinuum.ZEROTH_ORDER}, {label:"1th order", value: FittingContinuum.FIRST_ORDER}]} 
                            onChange={(ev) => fittingStore.setContinuum(parseInt(ev.target.value))}
                            disabled={true}
                        />
                    </FormGroup>
                    <FormGroup label="Components" inline={true}>
                        <div className={"components-controller"}>
                            <SafeNumericInput
                                value={fittingStore.components.length}
                                min={1}
                                max={10}
                                stepSize={1}
                                onValueChange={val => fittingStore.setComponents(Math.round(val))}
                            />
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
                        <FormGroup label="Auto detect" inline={true}>
                            <AnchorButton onClick={this.autoDetect} icon="series-search"/>
                        </FormGroup>
                        <FormGroup label="Cursor selection" inline={true}>
                            <AnchorButton onClick={this.cursorSelecting} active={fittingStore.isCursorSelectionOn} icon="select"/>
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
                        onClick={this.showLog}
                        intent={Intent.PRIMARY}
                        disabled={!fittingStore.hasResult}
                    />
                    <AnchorButton 
                        text="Save log"
                        intent={Intent.PRIMARY}
                        disabled={!fittingStore.hasResult}
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
