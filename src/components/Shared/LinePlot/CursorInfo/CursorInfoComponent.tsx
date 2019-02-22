import * as React from "react";
import {observer} from "mobx-react";
import "./CursorInfoComponent.css";

export class CursorInfoComponentProps {
    darkMode: boolean;
    cursorInfo: {cursorX: string, cursorY: string, rms: number, mean: number};
}

@observer
export class CursorInfoComponent extends React.Component<CursorInfoComponentProps> {

    private getFormatted = (value: number): string => {
        if (value === undefined) {
            return "";
        }
        return value < 1e-2 ? value.toExponential(2) : value.toFixed(2);
    };

    render() {
        let className = "profiler-cursorinfo";
        if (this.props.darkMode) {
            className += " bp3-dark";
        }

        let cursorInfo = (this.props.cursorInfo && this.props.cursorInfo.cursorX && this.props.cursorInfo.cursorY) ? (
            <tr>
                <th><pre>Cursor: </pre></th>
                <td>
                    <pre>{"(" + this.props.cursorInfo.cursorX + ", " + this.props.cursorInfo.cursorY + ")"}</pre>
                </td>
            </tr>
        ) : null;

        let statInfo = (this.props.cursorInfo && this.props.cursorInfo.rms && this.props.cursorInfo.mean) ? (
            <tr>
                <th><pre>Mean/RMS: </pre></th>
                <td>
                    <pre>{this.getFormatted(this.props.cursorInfo.mean) + " / " + this.getFormatted(this.props.cursorInfo.rms)}</pre>
                </td>
            </tr>
        ) : null;

        return (
            <div className={className}>
                <table className="cursor-display">
                    <tbody>
                        {cursorInfo}
                        {statInfo}
                    </tbody>
                </table>
            </div>
        );
    }
}
