import * as React from "react";
import {NumericInput} from "@blueprintjs/core";
import {clamp} from "utilities";

export class SafeNumericInput extends React.PureComponent<any> {
    safeHandleValueChanged = (valueAsNumber: number, valueAsString: string) => {
        if (isFinite(valueAsNumber)) {
            const clampedValue = clamp(valueAsNumber, this.props.min, this.props.max);
            if (clampedValue !== valueAsNumber) {
                valueAsString = valueAsNumber.toString();
            }
            if (this.props.onValueChange) {
                this.props.onValueChange(clampedValue, valueAsString);
            }
        }
    };

    render() {
        return <NumericInput {...this.props} onValueChange={this.safeHandleValueChanged}/>;
    }
}
