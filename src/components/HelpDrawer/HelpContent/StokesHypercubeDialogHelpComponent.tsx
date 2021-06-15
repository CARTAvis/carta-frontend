import * as React from "react";

export class StokesHypercubeDialogHelpComponent extends React.Component {
    public render() {
        return (
            <React.Fragment>
                <h3>Form a Stokes hypercube</h3>
                <p>
                    This dialog allows user to confirm the auto-identification of the Stokes parameters from the image list and make corrections when necessary. The auto-identification obtains information from the image headers. If Stokes
                    information is not available in the headers, CARTA will make a guess from the file names. Otherwise, you need to assign the Stokes parameters manually.
                </p>
            </React.Fragment>
        );
    }
}
