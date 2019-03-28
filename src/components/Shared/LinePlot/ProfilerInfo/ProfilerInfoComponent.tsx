import * as React from "react";
import {observer} from "mobx-react";
import {formattedNotation} from "utilities";
import "./ProfilerInfoComponent.css";

export class ProfilerInfoComponentProps {
    darkMode: boolean;
    cursorInfo: {isMouseEntered: boolean, cursorX: number, cursorY: number, xUnit: string};
    statInfo: {rms: number, mean: number};
}

@observer
export class ProfilerInfoComponent extends React.Component<ProfilerInfoComponentProps> {
    private getCursorInforLabel = () => {
        if (this.props.cursorInfo.cursorX === null || this.props.cursorInfo.cursorY === null ||
            isNaN(this.props.cursorInfo.cursorX) || isNaN(this.props.cursorInfo.cursorY)) {
            return null;
        }

        let xLabel = this.props.cursorInfo.xUnit === "Channel" ?
                    "Channel " + this.props.cursorInfo.cursorX.toFixed(0) :
                    formattedNotation(this.props.cursorInfo.cursorX) + " " + this.props.cursorInfo.xUnit;
        return "(" + xLabel + ", " + this.props.cursorInfo.cursorY.toExponential(2) + ")";
    };

    render() {
        let className = "profiler-info";
        if (this.props.darkMode) {
            className += " bp3-dark";
        }
        let cursorInfo = (this.props.cursorInfo) ? (
            <tr>
                <td className="td-label">
                    <pre>{this.props.cursorInfo.isMouseEntered ? "Cursor" : "Data"}</pre>
                </td>
                <td>
                    <pre>{this.getCursorInforLabel()}</pre>
                </td>
            </tr>
        ) : null;

        let statInfo = (this.props.statInfo) ? (
            <tr>
                <td><pre>Mean/RMS:</pre></td>
                <td>
                    <pre>{formattedNotation(this.props.statInfo.mean) + " / " + formattedNotation(this.props.statInfo.rms)}</pre>
                </td>
            </tr>
        ) : null;

        return (
            <div className={className}>
                <table className="info-display">
                    <tbody>
                        {cursorInfo}
                        {statInfo}
                    </tbody>
                </table>
            </div>
        );
    }
}
