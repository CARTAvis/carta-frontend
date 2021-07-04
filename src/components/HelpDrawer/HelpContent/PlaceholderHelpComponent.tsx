import * as React from "react";
import underConstruction from "static/help/under_construction.png";

export class PlaceholderHelpComponent extends React.Component {
    public render() {
        return (
            <React.Fragment>
                <p>To be added.</p>
                <img src={underConstruction} style={{width: "20%", height: "auto"}} />
            </React.Fragment>
        );
    }
}
