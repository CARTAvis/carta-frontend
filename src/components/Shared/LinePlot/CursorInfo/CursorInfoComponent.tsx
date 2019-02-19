import * as React from "react";
import {CSSProperties} from "react";
import {observer} from "mobx-react";
import "./CursorInfoComponent.css";

export class CursorInfoComponentProps {
    darkMode: boolean;
    visible: boolean;
}

@observer
export class CursorInfoComponent extends React.Component<CursorInfoComponentProps> {

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
                    <pre>{`Cursor: `}</pre>
                    <pre>{`Mean: `}</pre>
                </div>
            </div>
        );
    }
}
