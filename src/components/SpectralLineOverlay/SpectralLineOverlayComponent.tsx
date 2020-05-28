import * as React from "react";
import {action, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {Button, FormGroup, HTMLSelect, HTMLTable, Radio, RadioGroup, Switch} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {SafeNumericInput} from "components/Shared";
import {AppStore, HelpType, WidgetConfig, WidgetProps, WidgetsStore} from "stores";
import {RedshiftType, SPECTRAL_LINE_OPTION_DESCRIPTIONS, SpectralLineOptions, SpectralLineOverlayWidgetStore, SpectralLineQueryRangeType} from "stores/widgets";
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
            defaultWidth: 750,
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

    private handleQuery = () => {
        return;
    };

    private handlePlot = () => {
        return;
    };

    render() {
        const appStore = AppStore.Instance;
        const widgetStore = this.widgetStore;

        const inputByRange = (
            <React.Fragment>
                <FormGroup label="From" inline={true}>
                    <SafeNumericInput
                        value={widgetStore.redshiftSpeed}
                        buttonPosition="none"
                        onValueChange={val => widgetStore.setRedshiftSpeed(val)}
                    />
                </FormGroup>
                <FormGroup label="To" inline={true}>
                    <SafeNumericInput
                        value={widgetStore.redshiftSpeed}
                        buttonPosition="none"
                        onValueChange={val => widgetStore.setRedshiftSpeed(val)}
                    />
                </FormGroup>
            </React.Fragment>
        );

        const inputByCenter = (
            <React.Fragment>
                <FormGroup inline={true}>
                    <SafeNumericInput
                        value={widgetStore.redshiftSpeed}
                        buttonPosition="none"
                        onValueChange={val => widgetStore.setRedshiftSpeed(val)}
                    />
                </FormGroup>
                <FormGroup label="±" inline={true}>
                    <SafeNumericInput
                        value={widgetStore.redshiftSpeed}
                        buttonPosition="none"
                        onValueChange={val => widgetStore.setRedshiftSpeed(val)}
                    />
                </FormGroup>
            </React.Fragment>
        );

        const queryPanel = (
            <div className="query-panel">
                <RadioGroup
                    inline={true}
                    onChange={ev => widgetStore.setQueryRangeType(ev.currentTarget.value as SpectralLineQueryRangeType)}
                    selectedValue={widgetStore.queryRangeType}
                >
                    <Radio label={SpectralLineQueryRangeType.Range} value={SpectralLineQueryRangeType.Range}/>
                    <Radio label={SpectralLineQueryRangeType.Center} value={SpectralLineQueryRangeType.Center}/>
                </RadioGroup>
                {widgetStore.queryRangeType === SpectralLineQueryRangeType.Range ? inputByRange : inputByCenter}
                <FormGroup inline={true}>
                    <HTMLSelect options={["GHz", "MHz", "cm", "mm"]} value={"GHz"} onChange={() => {}}/>
                </FormGroup>
                <Button intent="success" small={true} onClick={this.handleQuery}>Query</Button>
            </div>
        );

        const optionTable = (
            <HTMLTable bordered={true} striped={true} condensed={true}>
                <thead>
                    <tr>
                        <th>Name</th><th>Description</th><th>Display</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.values(SpectralLineOptions).map((option) =>
                        <tr key={`${option}`}>
                            <td>{option}</td>
                            <td>{SPECTRAL_LINE_OPTION_DESCRIPTIONS.get(option)}</td>
                            <td>
                                <Switch
                                    key={`${option}-display`}
                                    checked={widgetStore.optionsDisplay.get(option)}
                                    onChange={() => widgetStore.setOptionsDisplay(option)}
                                />
                            </td>
                        </tr>
                    )}
                </tbody>
            </HTMLTable>
        );

        const redshiftPanel = (
            <div className="redshift-panel">
                <RadioGroup
                    inline={true}
                    onChange={ev => widgetStore.setRedshiftType(ev.currentTarget.value as RedshiftType)}
                    selectedValue={widgetStore.redshiftType}
                >
                    <Radio label={RedshiftType.V} value={RedshiftType.V}/>
                    <Radio label={RedshiftType.Z} value={RedshiftType.Z}/>
                </RadioGroup>
                <FormGroup label="Redshift" labelInfo={widgetStore.redshiftType === RedshiftType.V ? "(km/s)" : ""} inline={true}>
                    <SafeNumericInput
                        value={widgetStore.redshiftSpeed}
                        buttonPosition="none"
                        onValueChange={val => widgetStore.setRedshiftSpeed(val)}
                    />
                </FormGroup>
            </div>
        );

        const resultTable = (
            <HTMLTable bordered={true} striped={true} condensed={true}>
                <thead>
                    <tr>
                        <th>FORMULA</th><th>NAME</th><th>FREQ</th><th>REDSHIFTED_FREQ</th><th>ASTRO</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td></td><td></td><td></td><td></td><td></td></tr>
                </tbody>
            </HTMLTable>
        );

        let className = "spectral-line-overlay-widget";
        if (appStore.darkTheme) {
            className += " dark-theme";
        }

        return (
            <div className={className}>
                {queryPanel}
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
