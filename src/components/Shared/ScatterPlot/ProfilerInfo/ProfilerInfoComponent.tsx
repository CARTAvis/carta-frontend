import * as React from "react";
import {observer} from "mobx-react";
import "./ProfilerInfoComponent.css";

class ScatterProfilerInfoComponentProps {
    darkMode: boolean;
    cursorInfo: {isMouseEntered: boolean, cursorX: number, cursorY: number, xUnit: string};
    statInfo: {rms: number, mean: number};
}

@observer
export class ScatterProfilerInfoComponent extends React.Component<ScatterProfilerInfoComponentProps> {
    private getCursorInfoLabel = () => {
        if (this.props.cursorInfo.cursorX === null || this.props.cursorInfo.cursorY === null ||
            isNaN(this.props.cursorInfo.cursorX) || isNaN(this.props.cursorInfo.cursorY)) {
            return null;
        }
        return "(" + this.props.cursorInfo.cursorX.toExponential(2) + ", " + this.props.cursorInfo.cursorY.toExponential(2) + ")";
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
