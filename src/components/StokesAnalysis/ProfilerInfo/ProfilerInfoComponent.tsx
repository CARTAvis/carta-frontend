import * as React from "react";
import {observer} from "mobx-react";
import {formattedNotation, toExponential, toFixed} from "utilities";
import "./ProfilerInfoComponent.css";

class StokesAnalysisProfilerInfoComponentProps {
    darkMode: boolean;
    cursorInfo: {isMouseEntered: boolean, quValue: { x: number, y: number}, channel: number, pi: number, pa: number, xUnit: string};
    fractionalPol: boolean;
}

@observer
export class StokesAnalysisProfilerInfoComponent extends React.Component<StokesAnalysisProfilerInfoComponentProps> {
    private getCursorInfoLabel = () => {
        if (this.props.cursorInfo.quValue.x === null || this.props.cursorInfo.quValue.y === null ||
            isNaN(this.props.cursorInfo.quValue.x) || isNaN(this.props.cursorInfo.quValue.y)) {
            return null;
        }
        const xLabel = this.props.cursorInfo.xUnit === "Channel" ?
                    "Channel " + toFixed(this.props.cursorInfo.channel) :
                    formattedNotation(this.props.cursorInfo.channel) + " " + this.props.cursorInfo.xUnit;
        const qLabel = this.props.fractionalPol ? ", Q/I: " : ", Q: ";
        const uLabel = this.props.fractionalPol ? ", U/I: " : ", U: ";
        const piLabel = this.props.fractionalPol ? ", PI/I: " : ", PI: ";
        return "(" + xLabel 
                + qLabel + toExponential(this.props.cursorInfo.quValue.x, 2)
                + uLabel + toExponential(this.props.cursorInfo.quValue.y, 2)
                + piLabel + toExponential(this.props.cursorInfo.pi, 2)
                + ", PA: " + toFixed(this.props.cursorInfo.pa, 2)
                + ")";
    };

    render() {
        let className = "profiler-info";
        if (this.props.darkMode) {
            className += " bp3-dark";
        }
        let cursorInfo = (this.props.cursorInfo) ? (
            <tr>
                <td className="td-label">
                    <pre>{this.props.cursorInfo.isMouseEntered ? "Cursor:" : "Data:"}</pre>
                </td>
                <td>
                    <pre>{this.getCursorInfoLabel()}</pre>
                </td>
            </tr>
        ) : null;

        return (
            <div className={className}>
                <table className="info-display">
                    <tbody>
                        {cursorInfo}
                    </tbody>
                </table>
            </div>
        );
    }
}
