import * as React from "react";
import "./PlaceholderComponent.css";

class TestComponentProps {
    label: string;
}

export class PlaceholderComponent extends React.PureComponent<TestComponentProps> {

    render() {
        return (
            <div className="Placeholder">
                <h1>{this.props.label}</h1>
            </div>);
    }
}