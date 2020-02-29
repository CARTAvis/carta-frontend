import * as React from "react";
import * as underConstruction from "static/help/under_construction.png";

export class LayerListHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>The layer list widget displays loaded images as a list, which includes image name, rendering type (R as raster and C as contours) and layer visibility state, WCS matching state, channel index, and Stokes index. The
                    channel index and Stokes index are synchronized with the animator.</p>
                <p>Users may click &quot;R&quot; and/or &quot;C&quot; to hide/show a layer. For example, if users want to generate an image with contours only, users can hide raster images by clicking &quot;R&quot;.</p>
                <p>Per image, users can click the &quot;XY&quot; button to enable/disable spatial matching and click &quot;Z&quot; button to enable/disable spectral matching.</p>
                <p>The list order reflects the order of the frame slider in the animator. The order may be modified by selecting an entry by <code>clicking</code> then <code>click-and-dragging</code> to form a desired order.</p>
            </div>
        );
    }
}
