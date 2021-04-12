import * as React from "react";
import {computed} from "mobx"
import {observer} from "mobx-react";
import {AnchorButton, FormGroup, HTMLSelect, Slider, Pre, Text, Intent, Tooltip} from "@blueprintjs/core";
import {SafeNumericInput} from "components/Shared";
import {ProfileFittingStore} from "stores/ProfileFittingStore"
import {SpectralProfileWidgetStore} from "stores/widgets/SpectralProfileWidgetStore";
import {AppStore, SpectralProfileStore} from "stores";
import {ProcessedSpectralProfile} from "models";
import {CARTA} from "carta-protobuf";
import "./ProfileFittingComponent.scss";
import {autoDetecting} from "utilities/fitting_heuristics";
import {clamp} from "utilities";

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


    private onZerothOrderValueChanged = (val: number) => {
        this.props.fittingStore.setZerothOrderValue(val);
    }

    private onFirstOrderValueChanged = (val: number) => {
        this.props.fittingStore.setFirstOrderValue(val);
    }

    private onZerothOrderValueLocked = () => {
        this.props.fittingStore.setLockedZerothOrderValue(!this.props.fittingStore.lockedZerothOrderValue);
    }

    private onFirstOrderValueLocked = () => {
        this.props.fittingStore.setLockedFirstOrderValue(!this.props.fittingStore.lockedFirstOrderValue);
    }

    private cursorSelectingZerothOrder = () => {
        this.props.fittingStore.setIsCursorSelectingZerothOrder(!this.props.fittingStore.isCursorSelectingZerothOrder);
    }

    private cursorSelectingFirstOrder = () => {
        this.props.fittingStore.setIsCursorSelectingFirstOrder(!this.props.fittingStore.isCursorSelectingFirstOrder);
    }


    private onCenterValueChanged = (val: number) => {
        this.props.fittingStore.selectedComponent.setCenter(val);
    }

    private onAmpValueChanged = (val: number) => {
        this.props.fittingStore.selectedComponent.setAmp(val);
    }

    private onFwhmValueChanged = (val: number) => {
        this.props.fittingStore.selectedComponent.setFwhm(val);
    }

    private autoDetect = () => {
        this.reset();
        const guessComponents = autoDetecting(this.plottingData.x, Array.prototype.slice.call(this.plottingData.y));
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
        this.props.fittingStore.setIsCursorSelectionOn(!this.props.fittingStore.isCursorSelectionOn);
    }

    private onCenterLocked = () => {
        this.props.fittingStore.selectedComponent.setLockedCenter(!this.props.fittingStore.selectedComponent.lockedCenter);
    }

    private onAmpLocked = () => {
        this.props.fittingStore.selectedComponent.setLockedAmp(!this.props.fittingStore.selectedComponent.lockedAmp);
    }

    private onFwhmLocked = () => {
        this.props.fittingStore.selectedComponent.setLockedFwhm(!this.props.fittingStore.selectedComponent.lockedFwhm);
    }

    private showLog = () => {}

    private reset = () => {
        const fittingStore = this.props.fittingStore;
        fittingStore.setComponents(1,true);
        fittingStore.setHasResult(false);
        fittingStore.setContinuum(FittingContinuum.NONE);
        fittingStore.setIsCursorSelectingZerothOrder(false);
        fittingStore.setIsCursorSelectingFirstOrder(false);
        fittingStore.setIsCursorSelectionOn(false);
    }

    private fitData = () => {
        if (this.props.fittingStore.readyToFit) {
            this.props.fittingStore.fitData(this.plottingData.x, this.plottingData.y)
        }
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

    @computed get plottingData(): {x: number[] ,y: Float32Array | Float64Array} {
        const widgetStore = this.props.widgetStore;
        const frame = widgetStore.effectiveFrame;
        if (!frame) {
            return null;
        }

        let coordinateData: ProcessedSpectralProfile;
        let regionId = widgetStore.effectiveRegionId;
        if (frame.regionSet) {
            const region = frame.regionSet.regions.find(r => r.regionId === regionId);
            if (region && this.profileStore) {
                coordinateData = this.profileStore.getProfile(widgetStore.coordinate, region.isClosedRegion ? widgetStore.statsType : CARTA.StatsType.Sum);
            }
        }

        if (coordinateData && coordinateData.values && coordinateData.values.length &&
            frame.channelValues && frame.channelValues.length &&
            coordinateData.values.length === frame.channelValues.length) {
            const channelValues = frame.channelValues;
            let xMin = Math.min(channelValues[0], channelValues[channelValues.length - 1]);
            let xMax = Math.max(channelValues[0], channelValues[channelValues.length - 1]);

            if (!widgetStore.isAutoScaledX) {
                const localXMin = clamp(widgetStore.minX, xMin, xMax);
                const localXMax = clamp(widgetStore.maxX, xMin, xMax);
                xMin = localXMin;
                xMax = localXMax;
            }


            let xMinIndex, xMaxIndex;
            for (let i = 0; i < channelValues.length; i++) {
                const x = channelValues[i];
                if (x < xMin) {
                    continue;
                }
                if (!isFinite(xMinIndex)) {
                    xMinIndex = i;
                }

                if (x > xMax) {
                    break;
                }
                xMaxIndex = i;
            }

            return {x: channelValues.slice(xMinIndex, xMaxIndex + 1), y: coordinateData.values.slice(xMinIndex, xMaxIndex + 1)};
        }
        return null;
    }

    autoButtonTooltip = () => {
        return(
            <span><i>
                Automatically detect features in the spectrum <br/>
                and set initial guess for each component.<br/>
                [Experimental]
            </i></span>
        )
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
                    <div className="component-input">
                        <HTMLSelect 
                            value={fittingStore.continuum} 
                            options={[{label:"None", value: FittingContinuum.NONE}, {label:"0th order", value: FittingContinuum.ZEROTH_ORDER}, {label:"1th order", value: FittingContinuum.FIRST_ORDER}]} 
                            onChange={(ev) => fittingStore.setContinuum(parseInt(ev.target.value))}
                        />
                        {fittingStore.continuum === FittingContinuum.ZEROTH_ORDER &&
                            <AnchorButton onClick={this.cursorSelectingZerothOrder} active={fittingStore.isCursorSelectingZerothOrder} icon="select"/>
                        }
                        {fittingStore.continuum === FittingContinuum.FIRST_ORDER &&
                            <AnchorButton onClick={this.cursorSelectingFirstOrder} active={fittingStore.isCursorSelectingFirstOrder} icon="select"/>
                        }
                    </div>
                    </FormGroup>
                    {(fittingStore.continuum === FittingContinuum.ZEROTH_ORDER || fittingStore.continuum === FittingContinuum.FIRST_ORDER) &&
                        <FormGroup label="0th order value" inline={true}>
                            <div className="component-input">
                                <SafeNumericInput
                                    value={fittingStore.zerothOrderValue}
                                    onValueChange={this.onZerothOrderValueChanged}
                                    disabled={fittingStore.lockedZerothOrderValue}
                                    allowNumericCharactersOnly={false}
                                    buttonPosition="none"
                                    />
                                <AnchorButton onClick={this.onZerothOrderValueLocked} icon={fittingStore.lockedZerothOrderValue ? "lock" : "unlock"}/>
                            </div>
                        </FormGroup>
                    }
                    {fittingStore.continuum === FittingContinuum.FIRST_ORDER &&
                        <FormGroup label="1st order value" inline={true}>
                            <div className="component-input">
                                <SafeNumericInput
                                    value={fittingStore.firstOrderValue}
                                    onValueChange={this.onFirstOrderValueChanged}
                                    disabled={fittingStore.lockedFirstOrderValue}
                                    allowNumericCharactersOnly={false}
                                    buttonPosition="none"
                                    />
                                <AnchorButton onClick={this.onFirstOrderValueLocked} icon={fittingStore.lockedFirstOrderValue ? "lock" : "unlock"}/>
                            </div>
                        </FormGroup>
                    }
                    <FormGroup label="Components" inline={true}>
                        <div className={"components-controller"}>
                            <SafeNumericInput
                                value={fittingStore.components.length}
                                min={1}
                                max={20}
                                stepSize={1}
                                onValueChange={val => fittingStore.setComponents(Math.round(val))}
                            />
                            {fittingStore.components.length > 1 &&
                                <Slider
                                    value={fittingStore.selectedIndex + 1}
                                    min={1}
                                    stepSize={1}
                                    max={fittingStore.components.length}
                                    showTrackFill={false}
                                    onChange={val => fittingStore.setSelectedIndex(val - 1)}
                                    disabled={fittingStore.components.length <= 1}
                                />
                            }
                        </div>
                    </FormGroup>
                    <FormGroup inline={true}>
                        <FormGroup label="Auto detect" inline={true}>
                            <Tooltip content={this.autoButtonTooltip()}>
                                <AnchorButton onClick={this.autoDetect} icon="series-search"/>
                            </Tooltip>
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
                                <AnchorButton onClick={this.onCenterLocked} icon={fittingStore.selectedComponent.lockedCenter ? "lock" : "unlock"}/>
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
                                <AnchorButton onClick={this.onAmpLocked} icon={fittingStore.selectedComponent.lockedAmp ? "lock" : "unlock"}/>
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
                                <AnchorButton onClick={this.onFwhmLocked} icon={fittingStore.selectedComponent.lockedFwhm ? "lock" : "unlock"}/>
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
                        disabled={!fittingStore.readyToFit}
                    />
                </div>
            </div>
        );
    }
}
