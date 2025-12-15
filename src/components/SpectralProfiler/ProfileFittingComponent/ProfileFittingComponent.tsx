import * as React from "react";
import {AnchorButton, Button, FormGroup, HTMLSelect, Intent, Popover, Pre, Slider, Switch, Text, Tooltip} from "@blueprintjs/core";
import {action, autorun, IReactionDisposer, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {SafeNumericInput} from "components/Shared";
import {FittingContinuum, FittingFunction} from "enums";
import {AppStore, type ProfileFittingStore} from "stores";
import {type SpectralProfileWidgetStore} from "stores/Widgets";
import {exportTxtFile, getTimestamp} from "utilities";

import "./ProfileFittingComponent.scss";

export interface ProfileFittingComponentProps {
    fittingStore: ProfileFittingStore;
    widgetStore: SpectralProfileWidgetStore;
}

@observer
export class ProfileFittingComponent extends React.Component<ProfileFittingComponentProps> {
    @observable isShowingLog: boolean = false;
    @observable isShowingResultButton: boolean = false;
    private fittingStore: ProfileFittingStore;
    private widgetStore: SpectralProfileWidgetStore;
    private readonly disposers: IReactionDisposer[] = [];

    private onFunctionChanged = ev => {
        this.reset();
        this.fittingStore.setFunction(parseInt(ev.target.value));
    };

    private onContinuumValueChanged = ev => {
        this.fittingStore.setYIntercept(0);
        this.fittingStore.setSlope(0);
        this.fittingStore.setContinuum(parseInt(ev.target.value));
    };

    private onYInterceptValueChanged = (val: number) => {
        this.fittingStore.setYIntercept(val);
    };

    private onSlopeValueChanged = (val: number) => {
        this.fittingStore.setSlope(val);
    };

    private onYInterceptValueLocked = () => {
        this.fittingStore.setLockedYIntercept(!this.fittingStore.lockedYIntercept);
    };

    private onSlopeValueLocked = () => {
        this.fittingStore.setLockedSlope(!this.fittingStore.lockedSlope);
    };

    private cursorSelectingYIntercept = () => {
        this.fittingStore.setIsCursorSelectingYIntercept(!this.fittingStore.isCursorSelectingYIntercept);
    };

    private cursorSelectingSlope = () => {
        this.fittingStore.setIsCursorSelectingSlope(!this.fittingStore.isCursorSelectingSlope);
    };

    private onCenterValueChanged = (val: number) => {
        this.props.fittingStore.selectedComponent?.setCenter(val);
    };

    private onAmpValueChanged = (val: number) => {
        this.props.fittingStore.selectedComponent?.setAmp(val);
    };

    private onFwhmValueChanged = (val: number) => {
        this.props.fittingStore.selectedComponent?.setFwhm(val);
    };

    private onMouseOverResult = () => {
        this.setIsShowingResultButton(true);
    };

    private onMouseLeaveResult = () => {
        this.setIsShowingResultButton(false);
    };

    private autoDetect = () => {
        this.fittingStore.setHasResult(false);
        this.fittingStore.setComponents(1, true);
        if (this.widgetStore?.plotData?.fittingData) {
            this.fittingStore.autoDetect();
            if (this.fittingStore.isAutoDetectWithFitting) {
                this.fitData();
            }
        }
        this.fittingStore.setHasAutoDetectResult(true);
    };

    private deleteComponent = () => {
        this.fittingStore.deleteSelectedComponent();
    };

    private cursorSelecting = () => {
        this.fittingStore.setIsCursorSelectingComponentOn(!this.fittingStore.isCursorSelectingComponent);
    };

    private onCenterLocked = () => {
        const selectComponent = this.props.fittingStore.selectedComponent;
        selectComponent?.setLockedCenter(!selectComponent.lockedCenter);
    };

    private onAmpLocked = () => {
        const selectComponent = this.props.fittingStore.selectedComponent;
        selectComponent?.setLockedAmp(!selectComponent.lockedAmp);
    };

    private onFwhmLocked = () => {
        const selectComponent = this.props.fittingStore.selectedComponent;
        selectComponent?.setLockedFwhm(!selectComponent.lockedFwhm);
    };

    private showLog = () => {
        this.setIsShowingLog(true);
    };

    private handleLogClose = () => {
        this.setIsShowingLog(false);
    };

    private saveLog = () => {
        let headerString = "";
        const frame = this.widgetStore.effectiveFrame;
        if (frame && frame.frameInfo && frame.regionSet) {
            headerString += `# image: ${frame.filename}\n`;

            const regionId = this.widgetStore.effectiveRegionId;
            const region = frame.regionSet.regions.find(r => r.regionId === regionId);

            // statistic type, ignore when region == cursor
            if (regionId !== 0) {
                headerString += `# statistic: ${this.widgetStore.profileSelectionStore.selectedStatsTypes[0]}\n`;
            }
            // region info
            if (region) {
                headerString += `# ${region.regionProperties}\n`;
                if (frame.validWcs) {
                    headerString += `# ${frame.getRegionWcsProperties(region)}\n`;
                }
            }
        }

        const content = `${headerString}\n${this.fittingStore.resultLog}`;
        const fileName = `Profile_Fitting_Result_Log-${getTimestamp()}`;
        exportTxtFile(fileName, content);
    };

    @action private reset = () => {
        const fittingStore = this.fittingStore;
        fittingStore.setComponents(1, true);
        fittingStore.setHasResult(false);
        fittingStore.setContinuum(FittingContinuum.NONE);
        fittingStore.setYIntercept(0);
        fittingStore.setSlope(0);
        fittingStore.setResultYIntercept(0);
        fittingStore.setResultSlope(0);
        fittingStore.setIsCursorSelectingYIntercept(false);
        fittingStore.setIsCursorSelectingSlope(false);
        fittingStore.setIsCursorSelectingComponentOn(false);
        fittingStore.setHasAutoDetectResult(false);
    };

    private fitData = () => {
        if (this.fittingStore.readyToFit) {
            this.fittingStore.fitData();
        }
    };

    autoButtonTooltip = () => {
        return (
            <span>
                <i>
                    Automatically detect features in the spectrum <br />
                    and set initial guess for each component.
                    <br />
                    [Experimental]
                </i>
            </span>
        );
    };

    @action setIsShowingLog(val: boolean) {
        this.isShowingLog = val;
    }

    @action setIsShowingResultButton(val: boolean) {
        this.isShowingResultButton = val;
    }

    constructor(props: ProfileFittingComponentProps) {
        super(props);
        makeObservable(this);

        this.fittingStore = props.fittingStore;
        this.widgetStore = props.widgetStore;

        this.disposers.push(
            autorun(() => {
                // clear fitting data when the profile data changed
                if (this.widgetStore?.profileSelectionStore?.profiles[0]) {
                    this.reset();
                }

                if (this.widgetStore?.smoothingStore?.type) {
                    this.reset();
                }
            })
        );
    }

    componentWillUnmount() {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
    }

    render() {
        const appStore = AppStore.Instance;
        const fittingStore = this.fittingStore;
        const disabled = this.widgetStore.profileNum > 1;

        const cursorSelectionButton = (
            <Tooltip
                content={
                    <span>
                        <i>{fittingStore.isCursorSelectingComponent ? "Disable cursor selection" : "Enable cursor selection"}</i>
                    </span>
                }
            >
                <AnchorButton onClick={this.cursorSelecting} active={fittingStore.isCursorSelectingComponent} icon="select" disabled={disabled} />
            </Tooltip>
        );

        return (
            <div className="profile-fitting-panel">
                <Tooltip disabled={!disabled} content={"Profile fitting is not available when there are multiple profiles in the plot"}>
                    <FormGroup disabled={disabled}>
                        <div className="profile-fitting-form">
                            <FormGroup label="Data source" inline={true}>
                                <HTMLSelect
                                    value={appStore.activeFrameIndex}
                                    options={appStore.frames.map(frame => {
                                        return {label: frame.filename, value: frame.frameInfo.fileId};
                                    })}
                                    onChange={ev => appStore.setActiveImageByFileId(parseInt(ev.target.value))}
                                    disabled={disabled}
                                />
                            </FormGroup>
                            <FormGroup label="Profile function" inline={true}>
                                <HTMLSelect
                                    value={fittingStore.function}
                                    options={[
                                        {label: "Gaussian", value: FittingFunction.GAUSSIAN},
                                        {label: "Lorentzian", value: FittingFunction.LORENTZIAN}
                                    ]}
                                    onChange={this.onFunctionChanged}
                                    disabled={disabled}
                                />
                            </FormGroup>
                            <FormGroup label="Auto detect" inline={true}>
                                <div className={"component-input"}>
                                    <Tooltip content={this.autoButtonTooltip()}>
                                        <AnchorButton onClick={this.autoDetect} icon="series-search" disabled={disabled} data-testid="profile-fitting-auto-detect-button" />
                                    </Tooltip>
                                    <Switch label="w/ cont." checked={fittingStore.isAutoDetectWithCont} onChange={ev => fittingStore.setIsAutoDetectWithCont(!fittingStore.isAutoDetectWithCont)} disabled={disabled} />
                                    <Switch label="Auto fit" checked={fittingStore.isAutoDetectWithFitting} onChange={ev => fittingStore.setIsAutoDetectWithFitting(!fittingStore.isAutoDetectWithFitting)} disabled={disabled} />
                                </div>
                            </FormGroup>
                            {fittingStore.hasAutoDetectResult && (
                                <FormGroup label=" " inline={true}>
                                    <div data-testid="profile-fitting-auto-detect-info">{fittingStore.autoDetectResultText}</div>
                                </FormGroup>
                            )}
                            <FormGroup label="Components" inline={true}>
                                <div className={"components-input"}>
                                    <SafeNumericInput
                                        value={fittingStore.components.length}
                                        min={1}
                                        max={20}
                                        stepSize={1}
                                        onValueChange={val => fittingStore.setComponents(Math.round(val))}
                                        disabled={disabled}
                                        data-testid="profile-fitting-component-input"
                                    />
                                    {fittingStore.components.length > 1 && (
                                        <div className="components-slider">
                                            <Slider
                                                value={fittingStore.selectedIndex + 1}
                                                min={1}
                                                stepSize={1}
                                                max={fittingStore.components.length}
                                                showTrackFill={false}
                                                onChange={val => fittingStore.setSelectedIndex(val - 1)}
                                                disabled={fittingStore.components.length <= 1}
                                            />
                                            <Tooltip
                                                content={
                                                    <span>
                                                        <i>Delete current component</i>
                                                    </span>
                                                }
                                            >
                                                <AnchorButton intent={Intent.NONE} icon={"trash"} onClick={this.deleteComponent} />
                                            </Tooltip>
                                        </div>
                                    )}
                                </div>
                            </FormGroup>
                            {fittingStore.selectedComponent && (
                                <FormGroup label="Center" inline={true}>
                                    <div className="component-input">
                                        <SafeNumericInput
                                            value={fittingStore.selectedComponent.center}
                                            onValueChange={this.onCenterValueChanged}
                                            disabled={fittingStore.selectedComponent.lockedCenter || disabled}
                                            allowNumericCharactersOnly={false}
                                            buttonPosition="none"
                                            data-testid="profile-fitting-center-input"
                                        />
                                        <Tooltip
                                            content={
                                                <span>
                                                    <i>{fittingStore.selectedComponent.lockedCenter ? "Unlock center" : "Lock center"}</i>
                                                </span>
                                            }
                                        >
                                            <AnchorButton onClick={this.onCenterLocked} icon={fittingStore.selectedComponent.lockedCenter ? "lock" : "unlock"} disabled={disabled} />
                                        </Tooltip>
                                        {cursorSelectionButton}
                                    </div>
                                </FormGroup>
                            )}
                            {fittingStore.selectedComponent && (
                                <FormGroup label="Amplitude" inline={true}>
                                    <div className="component-input">
                                        <SafeNumericInput
                                            value={fittingStore.selectedComponent.amp}
                                            onValueChange={this.onAmpValueChanged}
                                            disabled={fittingStore.selectedComponent.lockedAmp || disabled}
                                            allowNumericCharactersOnly={false}
                                            buttonPosition="none"
                                            data-testid="profile-fitting-amplitude-input"
                                        />
                                        <Tooltip
                                            content={
                                                <span>
                                                    <i>{fittingStore.selectedComponent.lockedAmp ? "Unlock amplitude" : "Lock amplitude"}</i>
                                                </span>
                                            }
                                        >
                                            <AnchorButton onClick={this.onAmpLocked} icon={fittingStore.selectedComponent.lockedAmp ? "lock" : "unlock"} disabled={disabled} />
                                        </Tooltip>
                                        {cursorSelectionButton}
                                    </div>
                                </FormGroup>
                            )}
                            {fittingStore.selectedComponent && (
                                <FormGroup label="FWHM" inline={true}>
                                    <div className="component-input">
                                        <SafeNumericInput
                                            value={fittingStore.selectedComponent.fwhm}
                                            onValueChange={this.onFwhmValueChanged}
                                            disabled={fittingStore.selectedComponent.lockedFwhm || disabled}
                                            allowNumericCharactersOnly={false}
                                            buttonPosition="none"
                                            data-testid="profile-fitting-fwhm-input"
                                        />
                                        <Tooltip
                                            content={
                                                <span>
                                                    <i>{fittingStore.selectedComponent.lockedFwhm ? "Unlock FWHM" : "Lock FWHM"}</i>
                                                </span>
                                            }
                                        >
                                            <AnchorButton onClick={this.onFwhmLocked} icon={fittingStore.selectedComponent.lockedFwhm ? "lock" : "unlock"} disabled={disabled} />
                                        </Tooltip>
                                        {cursorSelectionButton}
                                    </div>
                                </FormGroup>
                            )}
                            <FormGroup label="Continuum" inline={true}>
                                <div className="component-input">
                                    <HTMLSelect
                                        value={fittingStore.continuum}
                                        options={[
                                            {label: "None", value: FittingContinuum.NONE},
                                            {label: "0th order", value: FittingContinuum.ZEROTH_ORDER},
                                            {label: "1st order", value: FittingContinuum.FIRST_ORDER}
                                        ]}
                                        onChange={this.onContinuumValueChanged}
                                        disabled={disabled}
                                    />
                                </div>
                            </FormGroup>
                            {(fittingStore.continuum === FittingContinuum.ZEROTH_ORDER || fittingStore.continuum === FittingContinuum.FIRST_ORDER) && (
                                <FormGroup label="Y intercept" inline={true}>
                                    <div className="component-input">
                                        <SafeNumericInput
                                            value={fittingStore.yIntercept}
                                            onValueChange={this.onYInterceptValueChanged}
                                            disabled={fittingStore.lockedYIntercept || disabled}
                                            allowNumericCharactersOnly={false}
                                            buttonPosition="none"
                                        />
                                        <AnchorButton onClick={this.onYInterceptValueLocked} icon={fittingStore.lockedYIntercept ? "lock" : "unlock"} disabled={disabled} />
                                        {fittingStore.continuum === FittingContinuum.ZEROTH_ORDER && (
                                            <AnchorButton onClick={this.cursorSelectingYIntercept} active={fittingStore.isCursorSelectingYIntercept} icon="select" disabled={disabled} />
                                        )}
                                        {fittingStore.continuum === FittingContinuum.FIRST_ORDER && <AnchorButton onClick={this.cursorSelectingSlope} active={fittingStore.isCursorSelectingSlope} icon="select" disabled={disabled} />}
                                    </div>
                                </FormGroup>
                            )}
                            {fittingStore.continuum === FittingContinuum.FIRST_ORDER && (
                                <FormGroup label="Slope" inline={true}>
                                    <div className="component-input">
                                        <SafeNumericInput value={fittingStore.slope} onValueChange={this.onSlopeValueChanged} disabled={fittingStore.lockedSlope || disabled} allowNumericCharactersOnly={false} buttonPosition="none" />
                                        <AnchorButton onClick={this.onSlopeValueLocked} icon={fittingStore.lockedSlope ? "lock" : "unlock"} disabled={disabled} />
                                        <AnchorButton onClick={this.cursorSelectingSlope} active={fittingStore.isCursorSelectingSlope} icon="select" disabled={disabled} />
                                    </div>
                                </FormGroup>
                            )}
                            <FormGroup label="Fitting result" inline={true}>
                                <div onMouseOver={this.onMouseOverResult} onMouseLeave={this.onMouseLeaveResult}>
                                    <div className="fitting-result">
                                        <Pre className="fitting-result-pre" disabled={disabled} data-testid="profile-fitting-result">
                                            <Text className="fitting-result-text">{fittingStore.resultString}</Text>
                                        </Pre>
                                    </div>
                                    {this.isShowingResultButton ? <Button icon="th" onClick={this.saveLog} className="fitting-result-hover-button" /> : <div style={{height: "30px"}} />}
                                </div>
                            </FormGroup>
                        </div>
                        <div className="profile-fitting-footer">
                            <AnchorButton text="Reset" intent={Intent.PRIMARY} onClick={this.reset} disabled={disabled} data-testid="profile-fitting-reset-button" />
                            <AnchorButton text="Fit" intent={Intent.PRIMARY} onClick={this.fitData} disabled={!fittingStore.readyToFit || disabled} data-testid="profile-fitting-fit-button" />
                            <Popover
                                isOpen={this.isShowingLog}
                                onClose={this.handleLogClose}
                                content={
                                    <div className="fitting-popover">
                                        <div className="fitting-log">
                                            <Pre className="fitting-log-pre">
                                                <Text className="fitting-log-text">{fittingStore.resultLog}</Text>
                                            </Pre>
                                        </div>
                                        <div className="fitting-popover-footer">
                                            <Button text="Save log" onClick={this.saveLog} className="fitting-log-button" />
                                        </div>
                                    </div>
                                }
                            >
                                <AnchorButton text="View log" onClick={this.showLog} intent={Intent.PRIMARY} disabled={!fittingStore.hasResult || disabled} />
                            </Popover>
                            <div className="switch-wrapper">
                                <Switch label="Residual" checked={fittingStore.enableResidual} onChange={ev => fittingStore.setEnableResidual(ev.currentTarget.checked)} disabled={disabled} />
                            </div>
                        </div>
                    </FormGroup>
                </Tooltip>
            </div>
        );
    }
}
