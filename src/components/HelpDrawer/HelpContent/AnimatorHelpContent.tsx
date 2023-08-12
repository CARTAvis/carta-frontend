import widgetButtonAnimator from "static/help/widgetButton_animator.png";
import widgetButtonAnimator_d from "static/help/widgetButton_animator_d.png";

import {ImageComponent} from "../ImageComponent";

export const ANIMATOR_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonAnimator} dark={widgetButtonAnimator_d} width="90%" />
        </p>
        <p>
        The Animator widget grants you control of the rendered context of an image cube in the image viewer. This includes the ability to designate which image, channel (if multiple channels are present within the active image file), and polarization component (if the active image file encompasses multiple Stokes parameters) you wish to explore. Moreover, you can have animation playback for any of these selections – image, channel, or polarization – using the <code>Play</code> button. To change the animating reference, the accompanying radio buttons serve as your guide. Various playback modes are available:
        </p>
        <ul>
            <li>
                <code>Forward</code>: the animation progresses with an increasing index.
            </li>
            <li>
                <code>Backward</code>: the animation regresses with a decreasing index.
            </li>
            <li>
                <code>Bouncing</code>: the animation cycles between increasing and decreasing indices, oscillating within the boundaries.
            </li>
            <li>
                <code>Blink</code>: the animation alternates between indices, effectively blinking back and forth across the boundary.
            </li>
        </ul>
        <p>For channel-specific animations, the double slider empowers you to constrain the channel range eligible for animation playback.</p>
        <p>You can specify the desired frames per second (fps) through the frame rate spinbox. Please note that the actual frames per second achievable are contingent upon both the CARTA backend performance and network capabilities.</p>
        <p>
        Facilitating channel-specific animation playback, a step value (defaulted at 1) can be established using the <code>Step</code> spinbox. By clicking the <code>Frame rate</code> dropdown, you can opt for the "Step" mode and subsequently define the preferred step value via the accompanying spinbox.
        </p>
        <p>
        The polarization slider encompasses a set of Stokes components derived from the image header. Additionally, it encompasses components derived from the Stokes parameters. These include:
            <ul>
                <li>
                    <code>Ptotal</code>: representing total polarization intensity, this value is computed from Stokes QU or QUV.
                </li>
                <li>
                    <code>Plinear</code>: reflecting linear polarization intensity, this is computed from Stokes QU.
                </li>
                <li>
                    <code>PFtotal</code>: indicating fractional total polarization intensity, this outcome arises from computations involving Stokes IQU or IQUV.
                </li>
                <li>
                    <code>PFlinear</code>: denoting fractional linear polarization intensity, this outcome results from calculations involving Stokes IQU.
                </li>
                <li>
                    <code>Pangle</code>: describing linear polarization angle, this parameter is computed from Stokes QU.
                </li>
            </ul>
        </p>
        <p>
        In order to maintain optimal performance and effective resource utilization, the default behavior entails automatic cessation of animation playback after 5 minutes. However, this parameter can be tailored to your preferences. Simply access the Performance tab within the preferences dialog (File -&gt; Preferences) to adjust this setting. The maximum allowable playback duration stands at 30 minutes.
        </p>
    </div>
);
