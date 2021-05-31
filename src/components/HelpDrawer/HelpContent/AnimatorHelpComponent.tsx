import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import headAnimatorButton from "static/help/head_animator_button.png";
import headAnimatorButton_d from "static/help/head_animator_button_d.png";

export class AnimatorHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p><ImageComponent light={headAnimatorButton} dark={headAnimatorButton_d} width="90%"/></p>
                <p>The animator widget controls which image, which channel (if exists per image file), and which Stokes (if exists per image file) to view in the image viewer. You may also enable animation playback for image, channel, or
                    Stokes, via the &quot;Play&quot; button. The radio buttons control which one to animate. Playback mode includes</p>
                <ul>
                    <li>Forward: with index increasing</li>
                    <li>Backward: with index decreasing</li>
                    <li>Bouncing: with index increasing and decreasing so on and so forth between the boundary</li>
                    <li>Blink: with index jumping between the boundary</li>
                </ul>
                <p>For channel, you may limit a channel range for animation playback via the double slider.</p>
                <p>A desired frame rate per second (fps) can be defined in the frame rate spinbox. Note that the real fps depends on computer performance and network performance.</p>
                <p>A step for animation playback (default 1) can be set with the step spinbox. Click the frame rate dropdown to select &quot;Step&quot; and use the spinbox to define a step.</p>
                <p>For performance concern and resource management, animation playback will be automatically stopped after 5 minutes by default. This can be customized in the &quot;Performance&quot; tab of the preferences dialog
                    (<strong>File</strong> -&gt; <strong>Preferences</strong>). Maximum playback time is 30 mins.</p>
            </div>
        );
    }
}
