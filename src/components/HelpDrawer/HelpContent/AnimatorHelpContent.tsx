import widgetButtonAnimator from "static/help/widgetButton_animator.png";
import widgetButtonAnimator_d from "static/help/widgetButton_animator_d.png";

import {ImageComponent} from "../ImageComponent";

export const ANIMATOR_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonAnimator} dark={widgetButtonAnimator_d} width="90%" />
        </p>
        <p>
            The Animator Widget provides you control of the rendered context of an image cube in the Image Viewer. This includes the ability to designate which image, channel (if multiple channels are present in the active image), and
            polarization component (if the active image has multiple Stokes parameters) you wish to explore. Moreover, you can have animation playback for any of these selections – image, channel, or polarization – using the <b>Play</b>{" "}
            button. To change the animation reference, the accompanying radio buttons serve as your guide. Various playback modes are available:
        </p>
        <ul>
            <li>
                <b>Forward</b>: the animation progresses with an increasing index.
            </li>
            <li>
                <b>Backward</b>: the animation regresses with a decreasing index.
            </li>
            <li>
                <b>Bouncing</b>: the animation cycles between increasing and decreasing indices, oscillating within the boundaries.
            </li>
            <li>
                <b>Blink</b>: the animation alternates between indices, effectively blinking back and forth across the boundary.
            </li>
        </ul>
        <p>For channel-specific animations, the double slider empowers you to constrain the channel range eligible for animation playback.</p>
        <p>
            You can specify the desired frames per second (fps) through the <b>Frame rate</b> spinbox. Please note that the actual frame rate achievable depends on the CARTA backend performance and network capabilities.
        </p>
        <p>
            Facilitating channel-specific animation playback, a step value (defaulted at 1) can be established using the <b>Step</b> spinbox. By clicking the <b>Frame rate</b> dropdown, you can opt for the <b>Step</b> mode and subsequently
            define the preferred step value via the accompanying spinbox.
        </p>
        <p>
            The <b>Polarization</b> slider encompasses a set of Stokes components derived from the image header. Additionally, it encompasses components derived from the Stokes parameters. These include:
            <ul>
                <li>
                    <b>Ptotal</b>: representing total polarization intensity, this value is computed from Stokes QU or QUV.
                </li>
                <li>
                    <b>Plinear</b>: reflecting linear polarization intensity, this is computed from Stokes QU.
                </li>
                <li>
                    <b>PFtotal</b>: indicating fractional total polarization intensity, this outcome arises from computations involving Stokes IQU or IQUV.
                </li>
                <li>
                    <b>PFlinear</b>: denoting fractional linear polarization intensity, this outcome results from calculations involving Stokes IQU.
                </li>
                <li>
                    <b>Pangle</b>: describing linear polarization angle, this parameter is computed from Stokes QU.
                </li>
            </ul>
        </p>
        <h4>NOTE</h4>
        <p>
            In order to maintain optimal performance and effective resource utilization, the default behavior entails automatic cessation of animation playback after 5 minutes. However, this parameter can be re-configured to your
            preferences. Simply access the <b>Performance</b> tab within the Preferences Dialog (<b>File -&gt; Preferences</b>) to adjust this setting. The maximum allowable playback duration is 30 minutes.
        </p>
    </div>
);
