import * as React from "react";
import {CSSProperties} from "react";
import {observer} from "mobx-react";
import {Point2D} from "models";
import "./CursorInfoComponent.css";

export class CursorInfoComponentProps {
    darkMode: boolean;
    visible: boolean;
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
        let styleProps: CSSProperties = {
            opacity: this.props.visible ? 1 : 0
        };

        let className = "profiler-cursorinfo";
        if (this.props.darkMode) {
            className += " bp3-dark";
        }

        return (
            <div className={className} style={styleProps}>
                <div className="cursor-display">
                    <table>
                        <tr>
                            <th><pre>Cursor: </pre></th>
                            <td>
                                <pre>
                                    {(this.props.cursorInfo && this.props.cursorInfo.nearesPoint) ?
                                    this.getFormatted(this.props.cursorInfo.nearesPoint.x) + " px" :
                                    ""}
                                </pre>
                            </td>
                            <th><pre>,</pre></th>
                            <td>
                                <pre>
                                    {(this.props.cursorInfo && this.props.cursorInfo.nearesPoint) ?
                                    this.getFormatted(this.props.cursorInfo.nearesPoint.y) :
                                    ""}
                                </pre>
                            </td>
                        </tr>
                        <tr>
                            <th><pre>Mean:</pre></th>
                            <td>
                                <pre>
                                    {(this.props.cursorInfo && this.props.cursorInfo.mean) ?
                                    this.getFormatted(this.props.cursorInfo.mean) :
                                    ""}
                                </pre>
                            </td>
                            <th><pre>RMS:</pre></th>
                            <td><pre>
                                    {(this.props.cursorInfo && this.props.cursorInfo.rms) ?
                                    this.getFormatted(this.props.cursorInfo.rms) :
                                    ""}
                                </pre>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
        );
    }
}
