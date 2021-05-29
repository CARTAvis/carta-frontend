import * as React from "react";

export class SpectralProfilerSettingsFittingHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <h3>Profile Fitting</h3>
                <p>With the fitting tab, users can fit the observed spectrum with a model profile. Please ensure that there is only one spectral profile in the plot. Fitting multiple observed spectra is not supported. The supported profile functions are:</p>
                <ul>
                    <li>Gaussian</li>
                    <li>Lorentzian</li>
                </ul>
                <p>In addtion, an optional continuum profile can be added in the fit, including a constant profile and a linear profile.</p>
                <h3>Set up initial solution for the fitter</h3>
                <p>In order to make the profiler fitting engine work properly, a good set of initial solution of the free parameters need to be supplied. CARTA includes an <em>experimental</em> algorithm to analyze the input profile and makes an educated guess of the initial solution. This can be archieved by clicking the &quot;auto detect&quot; button. If there is a prominent continuum emission, please enable the &quot;w/cont.&quot; toggle before clicking the &quot;auto detect&quot; button.</p>     
                <p>The auto detect function will report how many components are found in the spectrum and visualize them as green boxes in the plot. Their numerical values are provided too. To see the initial values of different components, please use the slider for navigation. New component may be added via the component spinbox. A component may be removed with the &quot;delete&quot; button.</p>
                <p>Users may use the GUI to define the initial solution <em>manually</em> by entering the values with the text fields, or by using mouse to draw a <em>box</em> on the plot. The height, width, and center position of the box represent the amplitude, FWHM, and center of a model profile, respectively. The lock button can be used to lock a parameter so that the parameter is fixed during the fitting process. The initial solution of a continuum can be defined manually by entering the values with the text fields, or by using mouse to draw a <em>line</em> on the plot (recommended).</p>
                <h4>NOTE</h4>
                <p>In case that the auto detect function does not return a sensible solution (e.g., unexpected number of components), users can still edit it manually before clicking the &quot;Fit&quot; button. Please note that the initial solution does not need to be set precisely with respect to the true solution. The profile fitting engine can tolerate the errors to some extent.</p>
                <h3>Tigger the fitting engine and view fitting results</h3>
                <p>Once users set up a good set of initial solution, the fitting process can be triggered by clicking the &quot;Fit&quot; button. If users would like to trigger the fitter right after a set of initial solution is found by the auto detect function, please enable the &quot;auto fit&quot; toggle. The fitting engine will include all the data in the current profile view. If users would like to exclude a certain feature in the fit, please try to zoom or pan the profile so that only the feature in interest is in the view.</p>
                <p>The fitting results are summarized in the &quot;Fitting result&quot; box. The best-fit model is visualized in the plot including the residual profle. Full log can be viewed with the &quot;View log&quot; button.</p>

            </div>
        );
    }
}
