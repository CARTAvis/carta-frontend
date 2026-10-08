import * as React from "react";
import {AnchorButton, ButtonGroup, Tooltip} from "@blueprintjs/core";

import {PlotType} from "enums";

interface PlotTypeSelectComponentProps {
    value: PlotType;
    onValueChanged: (value: PlotType) => void;
    showIcons?: boolean;
    toggleStyle?: boolean;
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

    private get selectedLineType(): PlotType | undefined {
        if (this.props.value === PlotType.STEPS || this.props.value === PlotType.POINTS_AND_STEPS) {
            return PlotType.STEPS;
        }
        if (this.props.value === PlotType.LINES || this.props.value === PlotType.POINTS_AND_LINES) {
            return PlotType.LINES;
        }
        return undefined;
    }

    private get hasPoints(): boolean {
        return this.props.value === PlotType.POINTS || this.props.value === PlotType.POINTS_AND_LINES || this.props.value === PlotType.POINTS_AND_STEPS;
    }

    private handleToggle = (value: PlotType) => {
        const lineType = value === PlotType.POINTS ? this.selectedLineType : this.selectedLineType === value ? undefined : value;
        const hasPoints = value === PlotType.POINTS ? !this.hasPoints : this.hasPoints;
        if (!lineType && !hasPoints) {
            return;
        }
        this.props.onValueChanged(lineType === PlotType.STEPS ? (hasPoints ? PlotType.POINTS_AND_STEPS : PlotType.STEPS) : lineType === PlotType.LINES ? (hasPoints ? PlotType.POINTS_AND_LINES : PlotType.LINES) : PlotType.POINTS);
    };

    private plotTypeButton = (value: PlotType) => {
        const isActive = this.props.toggleStyle ? (value === PlotType.POINTS ? this.hasPoints : this.selectedLineType === value) : this.props.value === value;
        const onClick = this.props.toggleStyle ? () => this.handleToggle(value) : () => this.props.onValueChanged(value);
        return (
            <Tooltip content={value}>
                <AnchorButton icon={PlotTypeSelectorComponent.getIconForType(value)} active={isActive} onClick={onClick} />
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
