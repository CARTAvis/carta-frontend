import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import headRegionButton from "static/help/head_region_button.png";
import headRegionButton_d from "static/help/head_region_button_d.png";

export class RegionListHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p><ImageComponent light={headRegionButton} dark={headRegionButton_d} width="90%"/></p>
                <p>Region list widget provides users a list of region created via the graphical user interface and/or via region import (<strong>File</strong> -&gt; <strong>Import regions</strong>). Basic information of a region is shown in
                    an entry in the list. The current active region is highlighted in the list and region control anchors are shown in the image viewer. To unselect a region, press <code>esc</code> key.</p>
                <p><code>Double-Click</code> on a list entry or on a region in the image viewer will bring up the region configuration dialogue, where users can adjust region appearance and region properties.</p>
                <p>The &quot;lock&quot; button for each region entry is to prevent editing a region accidentally. Locked regions will appear slightly dimmer in the image viewer. The &quot;center&quot; button is to center a region in the
                    current field of view of the image viewer.</p>
                <p>To delete an active (selected) region, press <code>delete</code> key.</p>
            </div>
        );
    }
}
