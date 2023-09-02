import widgetButtonAnimator from "static/help/widgetButton_animator.png";
import widgetButtonAnimator_d from "static/help/widgetButton_animator_d.png";

import {ImageComponent} from "../ImageComponent";

export const ANIMATOR_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonAnimator} dark={widgetButtonAnimator_d} width="90%" />
        </p>
        <p>
            The Animator Widget controls the rendered context of an image cube in the Image Viewer. This includes the ability to select which image, channel (if multiple channels are present in the active image), and polarization component
            (if the active image has multiple Stokes parameters) you wish to explore. You can also enable animation playback for any of these selections – image, channel, or polarization – using the <b>Play</b> button. To change the
            animation reference, use the accompanying radio buttons. Various playback modes are available:
        </p>
        <ul>
            <li>
                <b>Forward</b>: the animation plays the frames in order, looping back to the first frame when the last frame is reached.
            </li>
            <li>
                <b>Backward</b>: the animation plays the frames in reverse order, looping back to the last frame when the first frame is reached.
            </li>
            <li>
                <b>Bouncing</b>: the animation oscillates between the two boundaries, cycling between forward and reverse playback.
            </li>
            <li>
                <b>Blink</b>: the animation alternates between the first and last frame.
            </li>
        </ul>
        <p>For channel-specific animations, the double slider empowers you to constrain the channel range eligible for animation playback.</p>
        <p>
            You can specify the desired frames per second (fps) through the <b>Frame rate</b> spinbox. Please note that the actual achievable frame rate depends on CARTA backend performance and network capacity.
        </p>
        <p>
            To specify a step value for the channel animation, click the <b>Frame rate</b> dropdown to select the <b>Step</b> mode, and use the accompanying spinbox. The default value is 1.
        </p>
        <p>
            The <b>Polarization</b> slider includes both the Stokes components defined in the image header and components computed from the Stokes components, such as:
            <ul>
                <li>
                    <b>Ptotal</b>: total polarization intensity (computed from Stokes QU or QUV).
                </li>
                <li>
                    <b>Plinear</b>: linear polarization intensity (computed from Stokes QU).
                </li>
                <li>
                    <b>PFtotal</b>: fractional total polarization intensity (computed from Stokes IQU or IQUV).
                </li>
                <li>
                    <b>PFlinear</b>: fractional linear polarization intensity (computed from Stokes IQU).
                </li>
                <li>
                    <b>Pangle</b>: linear polarization angle (computed from Stokes QU).
                </li>
            </ul>
        </p>
        <h4>NOTE</h4>
        <p>
            For performance reasons and resource management, animation playback will be stopped automatically after 5 minutes by default. This can be customized in the <b>Performance</b> tab of the Preferences Dialog (
            <b>File -&gt; Preferences</b>). Maximum playback time is 30 mins.
        </p>
    </div>
);
