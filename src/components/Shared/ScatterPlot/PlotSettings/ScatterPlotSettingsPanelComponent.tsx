import * as React from "react";
import {FormGroup, Switch} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {ColormapComponent, SafeNumericInput} from "components/Shared";

import "./ScatterPlotSettingsPanelComponent.scss";

export class ScatterPlotSettingsPanelComponentProps {
    colorMap: string;
    scatterPlotPointSize: number;
    pointTransparency: number;
    equalAxes: boolean;
    invertedColorMap: boolean;
    setPointTransparency: (val: number) => void;
    setScatterPlotPointSize: (val: number) => void;
    setColormap: (val: string) => void;
    handleEqualAxesValuesChanged: (changeEvent: React.ChangeEvent<HTMLInputElement>) => void;
    handleInvertedColorMapChanged: (changeEvent: React.ChangeEvent<HTMLInputElement>) => void;
}

export enum ScatterSettings {
    MIN_POINT_SIZE = 0.5,
    MAX_POINT_SIZE = 10,
    MIN_TRANSPARENCY = 0.1,
    MAX_TRANSPARENCY = 1,
    POINT_SIZE_STEP_SIZE = 0.5,
    TRANSPARENCY_STEP_SIZE = 0.1
}

@observer
export class ScatterPlotSettingsPanelComponent extends React.Component<ScatterPlotSettingsPanelComponentProps> {
    render() {
        const props = this.props;
        return (
            <div className="scatter-settings-panel">
                <React.Fragment>
                    <FormGroup inline={true} label="Colormap">
                        <ColormapComponent
                            inverted={props.invertedColorMap}
                            selectedItem={props.colorMap}
                            onItemSelect={selected => {
                                props.setColormap(selected);
                            }}
                        />
                    </FormGroup>
                    <FormGroup label={"Invert colormap"} inline={true}>
                        <Switch checked={props.invertedColorMap} onChange={props.handleInvertedColorMapChanged} />
                    </FormGroup>
                    <FormGroup inline={true} label="Symbol size" labelInfo="(px)">
                        <SafeNumericInput
                            placeholder="Symbol size"
                            min={ScatterSettings.MIN_POINT_SIZE}
                            max={ScatterSettings.MAX_POINT_SIZE}
                            value={props.scatterPlotPointSize}
                            stepSize={ScatterSettings.POINT_SIZE_STEP_SIZE}
                            onValueChange={(value: number) => props.setScatterPlotPointSize(value)}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label="Transparency">
                        <SafeNumericInput
                            placeholder="Transparency"
                            min={ScatterSettings.MIN_TRANSPARENCY}
                            max={ScatterSettings.MAX_TRANSPARENCY}
                            value={props.pointTransparency}
                            stepSize={ScatterSettings.TRANSPARENCY_STEP_SIZE}
                            onValueChange={(value: number) => props.setPointTransparency(value)}
                        />
                    </FormGroup>
                    <FormGroup inline={true} label={"Equal axes"}>
                        <Switch checked={props.equalAxes} onChange={props.handleEqualAxesValuesChanged} />
                    </FormGroup>
                </React.Fragment>
            </div>
        );
    }
}
