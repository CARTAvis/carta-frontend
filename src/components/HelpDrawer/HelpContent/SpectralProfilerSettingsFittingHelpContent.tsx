export const SPECTRAL_PROFILER_SETTINGS_FITTING_HELP_CONTENT = (
    <div>
        <h3>Profile Fitting</h3>
        <p>
            With the fitting tab, you can fit the observed spectrum with a model profile. Please ensure that there is only one spectral profile in the plot. Fitting multiple observed spectra is not supported. The supported profile functions
            are:
        </p>
        <ul>
            <li>Gaussian</li>
            <li>Lorentzian</li>
        </ul>
        <p>In addition, an optional continuum profile can be added in the fit, including a constant profile and a linear profile.</p>
        <h3>Set up initial solution for the fitter</h3>
        <p>
            In order to work correctly, the profiler fitting engine must be supplied with a good set of initial solutions of the free parameters. CARTA includes an <em>experimental</em> algorithm which analyzes the input profile and makes
            an educated guess of the initial solution. To use it, click the <code>auto detect</code> button. If there is a prominent continuum emission, please enable the <code>w/cont.</code> toggle before clicking the{" "}
            <code>auto detect</code> button.
        </p>
        <p>
            The auto-detect function will report how many components are found in the spectrum and visualize them as green boxes in the plot. Their numerical values are provided too. To see the initial values of different components, please
            use the slider for navigation. New components may be added via the <code>Components</code> spinbox. A component may be removed with the <code>delete</code> button.
        </p>
        <p>
            You may use the GUI to define an initial solution <em>manually</em> by entering the values in the text fields, or by using the mouse to draw a <em>box</em> on the plot. The height, width, and center position of the box represent
            the amplitude, FWHM, and center of a model profile, respectively. The <code>lock</code> button can be used to lock a parameter so that the parameter is fixed during the fitting process. You can define an initial solution of a
            continuum manually by entering the values in the text fields, or by using the mouse to draw a <em>line</em> on the plot (recommended).
        </p>
        <h4>NOTE</h4>
        <p>
            If the auto-detect function does not return a sensible solution (e.g., unexpected number of components), you can still edit it manually before clicking the <code>Fit</code> button. Please note that the initial solution does not
            need to be set precisely with respect to the true solution. The profile fitting engine can tolerate errors to some extent.
        </p>
        <h3>Trigger the fitting engine and view fitting results</h3>
        <p>
            Once you have set up a good set of initial solutions, you can trigger the fitting process by clicking the <code>Fit</code> button. If you would like to trigger the fitter right after a set of initial solutions is found by the
            auto-detect function, please enable the <code>auto fit</code> toggle. The fitting engine will include all the data in the current profile view. If you would like to include a certain feature in the fit, please try to zoom or pan
            the profile so that only the feature in interest is in the view.
        </p>
        <p>
            The fitting results are summarized in the <code>Fitting result</code> box. The best-fit model is visualized in the plot including the residual profile. The full log can be viewed with the <code>View log</code> button.
        </p>
    </div>
);
