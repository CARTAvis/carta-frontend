import {ImageComponent} from "../ImageComponent";
import figAnimatorButton from "static/help/widgetButton_animator.png";
import figAnimatorButton_d from "static/help/widgetButton_animator_d.png";

export const ANIMATOR_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={figAnimatorButton} dark={figAnimatorButton_d} width="90%" />
        </p>
        <p>
            The animator widget controls which image, which channel (if there are multiple channels per active image file), and which polarizarion component (if there are multiple Stokes per active image file) to view in the image viewer. You may also enable animation playback for image, channel, or
            polarization, via the <code>Play</code> button. The radio buttons control which one to animate through. Playback mode includes
        </p>
        <ul>
            <li><code>Forward</code>: with index increasing</li>
            <li><code>Backward</code>: with index decreasing</li>
            <li><code>Bouncing</code>: with index increasing and decreasing so on and so forth between the boundary</li>
            <li><code>Blink</code>: with index jumping between the boundary</li>
        </ul>
        <p>For channel, you may limit a channel range for animation playback via the double slider.</p>
        <p>A desired frame rate per second (fps) can be defined in the frame rate spinbox. Note that the real fps depends on computer performance and network performance.</p>
        <p>
            A step for channel animation playback (default 1) can be set with the step spinbox. Click the frame rate dropdown to select <code>Step</code> and use the spinbox to define a step.
        </p>
        <p>
            For performance reasons and resource management, animation playback will be automatically stopped after 5 minutes by default. This can be customized in the <code>Performance</code> tab of the preferences dialog (
            <strong>File</strong> -&gt; <strong>Preferences</strong>). Maximum playback time is 30 mins.
        </p>
        <p>
            The polarization slider includes the Stokes components defined in the image header, as well as the <em>computed</em> components from the Stokes components, such as:
            <ul>
                <li><code>Ptotal</code>: total polarization intensity (computed from Stokes QU or QUV)</li>
                <li><code>Plinear</code>: linear polarization intensity (computed from Stokes QU)</li>
                <li><code>PFtotal</code>: fractional total polarization intensity (computed from Stokes IQU or IQUV)</li>
                <li><code>PFlinear</code>: fractional linear polarization intensity (computed from Stokes IQU)</li>
                <li><code>Pangle</code>: linear polarization angle (computed from Stokes QU)</li>
            </ul>
        </p>
    </div>
);
