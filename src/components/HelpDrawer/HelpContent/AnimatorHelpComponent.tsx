import * as React from "react";
import * as underConstruction from "static/help/under_construction.png";

export class AnimatorHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>The animator widget controls which frame (a.k.a image file), which channel (if exists per image file), and which
        Stokes (if exists per image file) to view in the image viewer. Users may also enable animation playback for
        frame, channel, or Stokes, via the &quot;Play&quot; button. The radio buttons control which one to animate.
        Playback mode includes</p>
                <ul>
                    <li>Forward: with index increasing</li>
                    <li>Backward: with index decreasing</li>
                    <li>Bouncing: with index increasing and decresing so on and so forth between the boundary</li>
                    <li>Blink: with index jumping between the boundary</li>
                </ul>
                <p>For channel, users may limit a channel range for animation playback via the double slider.</p>
                <p>A desired frame rate per second (fps) can be defined in the frame rate spinbox. Note that the real fps depends on
        computer performance and network performance.</p>
                <p>For performance concern and resource manegment, animation playback will be automatically stopped after 5 minutes
                    by default. This can be customized in the &quot;Performance&quot; tab of the preferences dialogue
        (<strong>File</strong> -&gt; <strong>Preferences</strong>). Maximum playback time is 30 mins.</p>
            </div>
        );
    }
}
