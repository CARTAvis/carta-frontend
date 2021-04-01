import * as React from "react";
import {makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {Alert, Button, FormGroup, MenuItem, Switch} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {AppStore, FrameScaling, RenderConfigStore} from "stores";
import {ColormapComponent, ScalingSelectComponent, SCALING_POPOVER_PROPS, SafeNumericInput} from "components/Shared";

const HistogramSelect = Select.ofType<boolean>();

interface ColormapConfigProps {
    renderConfig: RenderConfigStore;
    onCubeHistogramSelected: () => void;
    onCubeHistogramCancelled?: () => void;
    darkTheme: boolean;
    warnOnCubeHistogram: boolean;
    showHistogramSelect: boolean;
    disableHistogramSelect: boolean;
}

@observer
export class ColormapConfigComponent extends React.Component<ColormapConfigProps> {
    @observable showCubeHistogramAlert: boolean;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    renderHistogramSelectItem = (isCube: boolean, {handleClick, modifiers, query}) => {
        return <MenuItem text={isCube ? "Per-Cube" : "Per-Channel"} onClick={handleClick} key={isCube ? "cube" : "channel"}/>;
    };

    handleInvertedChanged: React.FormEventHandler<HTMLInputElement> = (evt) => {
        this.props.renderConfig.setInverted(evt.currentTarget.checked);
    };

    handleHistogramChange = (value: boolean) => {
        if (value && !this.props.renderConfig.cubeHistogram) {
            if (this.props.warnOnCubeHistogram) {
                this.showCubeHistogramAlert = true;
            } else {
                this.handleAlertConfirm();
            }
        } else {
            this.props.renderConfig.setUseCubeHistogram(value);
        }
    };

    render() {
        if (!this.props.renderConfig) {
            return null;
        }

        const renderConfig = this.props.renderConfig;
        return (
            <React.Fragment>
                {this.props.showHistogramSelect &&
                <FormGroup label={"Histogram"} inline={true} disabled={this.props.disableHistogramSelect}>
                    <HistogramSelect
                        activeItem={renderConfig.useCubeHistogram}
                        popoverProps={SCALING_POPOVER_PROPS}
                        filterable={false}
                        items={[true, false]}
                        onItemSelect={this.handleHistogramChange}
                        itemRenderer={this.renderHistogramSelectItem}
                        disabled={this.props.disableHistogramSelect}
                    >
                        <Button text={renderConfig.useCubeHistogram ? "Per-Cube" : "Per-Channel"} rightIcon="double-caret-vertical" alignText={"right"} disabled={this.props.disableHistogramSelect}/>
                    </HistogramSelect>
                </FormGroup>
                }
                <FormGroup label={"Scaling"} inline={true}>
                    <ScalingSelectComponent
                        selectedItem={renderConfig.scaling}
                        onItemSelect={renderConfig.setScaling}
                    />
                </FormGroup>
                <FormGroup label={"Color map"} inline={true}>
                    <ColormapComponent
                        inverted={renderConfig.inverted}
                        selectedItem={renderConfig.colorMap}
                        onItemSelect={renderConfig.setColorMap}
                    />
                </FormGroup>
                <FormGroup label={"Invert color map"} inline={true}>
                    <Switch
                        checked={renderConfig.inverted}
                        onChange={this.handleInvertedChanged}
                    />
                </FormGroup>
                {(renderConfig.scaling === FrameScaling.LOG || renderConfig.scaling === FrameScaling.POWER) &&
                <FormGroup label={"Alpha"} inline={true}>
                    <SafeNumericInput
                        min={RenderConfigStore.ALPHA_MIN}
                        max={RenderConfigStore.ALPHA_MAX}
                        buttonPosition={"none"}
                        value={renderConfig.alpha}
                        onValueChange={renderConfig.setAlpha}
                    />
                </FormGroup>
                }
                {renderConfig.scaling === FrameScaling.GAMMA &&
                <FormGroup label={"Gamma"} inline={true}>
                    <SafeNumericInput
                        min={RenderConfigStore.GAMMA_MIN}
                        max={RenderConfigStore.GAMMA_MAX}
                        stepSize={0.1}
                        minorStepSize={0.01}
                        majorStepSize={0.5}
                        value={renderConfig.gamma}
                        onValueChange={renderConfig.setGamma}
                    />
                </FormGroup>
                }
                <Alert className={AppStore.Instance.darkTheme ? "bp3-dark" : ""} icon={"time"} isOpen={this.showCubeHistogramAlert} onCancel={this.handleAlertCancel} onConfirm={this.handleAlertConfirm} cancelButtonText={"Cancel"}>
                    <p>
                        Calculating a cube histogram may take a long time, depending on the size of the file. Are you sure you want to continue?
                    </p>
                </Alert>
            </React.Fragment>
        );
    }

    private handleAlertConfirm = () => {
        this.props.onCubeHistogramSelected();
        this.showCubeHistogramAlert = false;
    };

    private handleAlertCancel = () => {
        this.showCubeHistogramAlert = false;
    };
}