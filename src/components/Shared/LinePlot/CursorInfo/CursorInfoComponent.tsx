import * as React from "react";
import {observer} from "mobx-react";
import {Point2D} from "models";
import "./CursorInfoComponent.css";

export class CursorInfoComponentProps {
    darkMode: boolean;
    cursorInfo: {nearesPoint: Point2D, rms: number, mean: number};
}

@observer
export class CursorInfoComponent extends React.Component<CursorInfoComponentProps> {

    private getFormatted = (value: number): string => {
        if (value === undefined) {
            return "";
        }

        // Switch between standard and scientific notation
        if (value < 1e-2) {
            return value.toExponential(2);
        }

        return value.toFixed(2);
    };

    render() {
        let className = "profiler-cursorinfo";
        if (this.props.darkMode) {
            className += " bp3-dark";
        }

        let cursorInfo = (this.props.cursorInfo && this.props.cursorInfo.nearesPoint) ? (
            <tr>
                <th><pre>Cursor: </pre></th>
                <td>
                    <pre>{this.getFormatted(this.props.cursorInfo.nearesPoint.x) + " px, " + this.getFormatted(this.props.cursorInfo.nearesPoint.y)}</pre>
                </td>
            </tr>
        ) : "";

        let statInfo = (this.props.cursorInfo && this.props.cursorInfo.rms && this.props.cursorInfo.mean) ? (
            <tr>
                <th><pre>Mean/RMS: </pre></th>
                <td>
                    <pre>{this.getFormatted(this.props.cursorInfo.mean) + " / " + this.getFormatted(this.props.cursorInfo.rms)}</pre>
                </td>
            </tr>
        ) : "";

        return (
            <div className={className}>
                <table className="cursor-display">
                    {cursorInfo}
                    {statInfo}
                </table>
            </div>
        );
    }
}
