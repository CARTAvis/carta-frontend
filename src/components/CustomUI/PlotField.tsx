import * as React from "react";
import Plot from "react-plotly.js";
import type {FieldProps} from "@rjsf/utils";

export function PlotField(props: FieldProps) {
    const value = (props.formData ?? {}) as {data?: any[]; layout?: any; config?: any};
    const data = value.data ?? [];
    const layout = value.layout ?? {};
    const config = value.config ?? {};
    return <Plot data={data} layout={layout} config={config} useResizeHandler={true} style={{width: "100%", height: "100%"}} />;
}
