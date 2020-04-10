import * as React from "react";
import {NumericInput} from "@blueprintjs/core";

export class SafeNumericInput extends React.PureComponent<any> {
    safeHandleValueChanged = (valueAsNumber: number, valueAsString: string) => {
        if (this.props.onValueChange && isFinite(valueAsNumber)) {
            this.props.onValueChange(valueAsNumber, valueAsString);
        }
    };

    render() {
        return <NumericInput {...this.props} onValueChange={this.safeHandleValueChanged}/>;
    }
}
