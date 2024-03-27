import * as React from "react";
import {AnchorButton, ButtonGroup, Tooltip} from "@blueprintjs/core";

export enum PlotType {
    STEPS = "Steps",
    LINES = "Lines",
    POINTS = "Points"
}

interface PlotTypeSelectComponentProps {
    value: PlotType;
    onValueChanged: (value: PlotType) => void;
    showIcons?: boolean;
}

export class PlotTypeSelectorComponent extends React.Component<PlotTypeSelectComponentProps> {
    private static getIconForType(value: PlotType) {
        switch (value) {
            case PlotType.STEPS:
                return "step-chart";
            case PlotType.LINES:
                return "timeline-line-chart";
            default:
                return "scatter-plot";
        }
    }

    private plotTypeButton = (value: PlotType) => {
        return (
            <Tooltip content={value}>
                <AnchorButton icon={PlotTypeSelectorComponent.getIconForType(value)} active={this.props.value === value} onClick={() => this.props.onValueChanged(value)} />
            </Tooltip>
        );
    };

    public render() {
        return (
            <ButtonGroup className={"plot-type-selector"}>
                {this.plotTypeButton(PlotType.STEPS)}
                {this.plotTypeButton(PlotType.LINES)}
                {this.plotTypeButton(PlotType.POINTS)}
            </ButtonGroup>
        );
    }
}
