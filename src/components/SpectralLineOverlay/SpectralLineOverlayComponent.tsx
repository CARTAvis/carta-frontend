import * as React from "react";
import {action, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {Button, Checkbox, FormGroup, HTMLSelect, HTMLTable, Radio, RadioGroup} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {SafeNumericInput} from "components/Shared";
import {AppStore, HelpType, WidgetConfig, WidgetProps, WidgetsStore} from "stores";
import {Doppler, RedshiftGroup, SPECTRAL_LINE_OPTION_DESCRIPTIONS, SpectralLineOptions, SpectralLineOverlayWidgetStore} from "stores/widgets";
import {SpectralSystem} from "models";
import "./SpectralLineOverlayComponent.css";

@observer
export class SpectralLineOverlayComponent extends React.Component<WidgetProps> {
    @observable width: number;
    @observable height: number;
    @observable widgetId: string;

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "spectral-line-overlay",
            type: "spectral-line-overlay",
            minWidth: 320,
            minHeight: 400,
            defaultWidth: 600,
            defaultHeight: 600,
            title: "Spectral Line Overlay",
            isCloseable: true,
            helpType: HelpType.SPECTRAL_LINE_OVERLAY,
            componentId: "spectral-line-overlay-component"
        };
    }

    @computed get widgetStore(): SpectralLineOverlayWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.spectralLineOverlayWidgets) {
            const widgetStore = widgetsStore.spectralLineOverlayWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new SpectralLineOverlayWidgetStore();
    }

    @action onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    private handlePlot = () => {
        return;
    };

    render() {
        const appStore = AppStore.Instance;
        const widgetStore = this.widgetStore;

        const wcsGroup = (
            <FormGroup label="WCS Group" inline={true}>
                <HTMLSelect/>
            </FormGroup>
        );

        const optionTable = (
            <HTMLTable bordered={true} striped={true} condensed={true}>
                <thead>
                    <tr>
                        <th>Name</th><th>Description</th><th>Display</th><th>Label</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.values(SpectralLineOptions).map((option) =>
                        <tr key={`${option}`}>
                            <td>{option}</td>
                            <td>{SPECTRAL_LINE_OPTION_DESCRIPTIONS.get(option)}</td>
                            <td>
                                <Checkbox
                                    key={`${option}-display`}
                                    checked={widgetStore.optionsDisplay.get(option)}
                                    onChange={() => widgetStore.setOptionsDisplay(option)}
                                />
                            </td>
                            <td>
                                <Checkbox
                                    key={`${option}-label`}
                                    checked={widgetStore.optionsLabel.get(option)}
                                    onChange={() => widgetStore.setOptionsLabel(option)}
                                />
                            </td>
                        </tr>
                    )}
                </tbody>
            </HTMLTable>
        );

        const redshiftPanel = (
            <div>
                <FormGroup label="Redshift" labelInfo={widgetStore.redshiftGroup === RedshiftGroup.V ? "(km/s)" : ""} inline={true}>
                    <SafeNumericInput
                        value={widgetStore.redshiftSpeed}
                        buttonPosition="none"
                        onValueChange={val => widgetStore.setRedshiftSpeed(val)}
                    />
                </FormGroup>
                <RadioGroup
                    inline={true}
                    onChange={ev => widgetStore.setRedshiftGroup(ev.currentTarget.value as RedshiftGroup)}
                    selectedValue={widgetStore.redshiftGroup}
                >
                    <Radio label={RedshiftGroup.V} value={RedshiftGroup.V}/>
                    <Radio label={RedshiftGroup.Z} value={RedshiftGroup.Z}/>
                </RadioGroup>
                <FormGroup label="Frame" inline={true}>
                    <HTMLSelect options={[SpectralSystem.LSRK, SpectralSystem.BARY]} value={widgetStore.spectralSystem} onChange={(ev) => widgetStore.setSpectralSystem(ev.currentTarget.value as SpectralSystem)}/>
                </FormGroup>
                <FormGroup label="Doppler" inline={true}>
                    <HTMLSelect options={[Doppler.Radio, Doppler.Optical]} value={widgetStore.doppler} onChange={(ev) => widgetStore.setDoppler(ev.currentTarget.value as Doppler)}/>
                </FormGroup>
            </div>
        );

        const resultTable = (
            <table>
                <thead>
                    <tr>
                        <th>FORMULA</th><th>NAME</th><th>FREQ</th><th>REDSHIFTED_FREQ</th><th>ASTRO</th>
                    </tr>
                </thead>
            </table>
        );

        let className = "spectral-line-overlay-widget";
        if (appStore.darkTheme) {
            className += " dark-theme";
        }

        return (
            <div className={className}>
                {wcsGroup}
                {optionTable}
                {redshiftPanel}
                {resultTable}
                <div className="spectral-line-plot">
                    <Button intent="success" onClick={this.handlePlot}>Plot</Button>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}
