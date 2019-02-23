import * as React from "react";
import {observer} from "mobx-react";
import {formattedNotation} from "utilities";
import "./ProfilerInfoComponent.css";

export class ProfilerInfoComponentProps {
    darkMode: boolean;
    cursorInfo: {label: string, cursorX: string, cursorY: string};
    statInfo: {rms: number, mean: number};
}

@observer
export class ProfilerInfoComponent extends React.Component<ProfilerInfoComponentProps> {
    render() {
        let className = "profiler-info";
        if (this.props.darkMode) {
            className += " bp3-dark";
        }

        let cursorInfo = (this.props.cursorInfo && this.props.cursorInfo.label && this.props.cursorInfo.cursorX && this.props.cursorInfo.cursorY) ? (
            <tr>
                <td className = "td-label"><pre>{this.props.cursorInfo.label}</pre></td>
                <td>
                    <pre>{"(" + this.props.cursorInfo.cursorX + ", " + this.props.cursorInfo.cursorY + ")"}</pre>
                </td>
            </tr>
        ) : null;

        let statInfo = (this.props.statInfo && this.props.statInfo.rms && this.props.statInfo.mean) ? (
            <tr>
                <td><pre>Mean/RMS: </pre></td>
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
