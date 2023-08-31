export const SPECTRAL_PROFILER_SETTINGS_FITTING_HELP_CONTENT = (
    <div>
        <h3>Profile Fitting</h3>
        <p>
            With the <b>Fitting</b> tab, you can fit the observed spectrum with a model profile including multiple Gaussians. Please ensure that there is only one spectral profile in the plot (single-profile plotting mode). Fitting multiple
            observed spectra is not supported. The supported profile functions are:
        </p>
        <ul>
            <li>Gaussian</li>
            <li>Lorentzian</li>
        </ul>
        <p>In addition, an optional continuum profile can be added in the fit, including a constant profile and a linear profile.</p>
        <h3>Set up initial solution for the fitter</h3>
        <p>
            In order to work correctly, the profiler fitting engine must be supplied with a good set of initial solutions of the free parameters. CARTA includes an <em>experimental</em> algorithm which analyzes the input profile and makes
            an educated guess of the initial solution. To use it, click the <b>Auto detect</b> button. If there is a prominent continuum emission, please enable the <b>w/cont.</b> toggle before clicking the <b>Auto detect</b> button.
        </p>
        <p>
            The auto-detect function will report how many components are found in the spectrum and visualize them as green boxes in the plot. Their numerical values are provided too. To see the initial values of different components, please
            use the slider for navigation. New components may be added via the <b>Components</b> spinbox. A component may be removed with the <b>Delete</b> button (the garbage can button).
        </p>
        <p>
            You may use the GUI to define an initial solution <em>manually</em> by entering the values in the input fields, or by using the mouse to draw a <em>box</em> on the plot. The height, width, and center position of the box
            represent the amplitude, FWHM, and center of a model profile, respectively. The <b>Lock</b> button can be used to lock a parameter so that the parameter is fixed during the fitting process. You can define an initial solution of
            a continuum manually by entering the values in the text fields, or by using the mouse to draw a <em>line</em> on the plot (recommended).
        </p>
        <h4>NOTE</h4>
        <p>
            If the auto-detect function does not return a sensible solution (e.g., unexpected number of components), you can still edit it manually before clicking the <b>Fit</b> button. Please note that the initial solution does not need
            to be set precisely with respect to the true solution. The profile fitting engine can tolerate errors to some extent.
        </p>
        <h3>Trigger the fitting engine and view fitting results</h3>
        <p>
            Once you have set up a good set of initial solutions, you can trigger the fitting process by clicking the <b>Fit</b> button. If you would like to trigger the fitter right after a set of initial solutions is found by the
            auto-detect function, please enable the <b>Auto fit</b> toggle. The fitting engine will include all the data in the current profile view. If you would like to include a certain feature in the fit, please try to zoom or pan the
            profile so that only the feature in interest is in the view.
        </p>
        <p>
            The fitting results are summarized in the <b>Fitting result</b> box. The best-fit model is visualized in the plot including the residual profile. The full log can be viewed with the <b>View log</b> button.
        </p>
    </div>
);
