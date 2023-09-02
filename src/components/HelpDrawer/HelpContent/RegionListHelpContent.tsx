import widgetButtonRegionList from "static/help/widgetButton_regionList.png";
import widgetButtonRegionList_d from "static/help/widgetButton_regionList_d.png";

import {ImageComponent} from "../ImageComponent";

export const REGION_LIST_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonRegionList} dark={widgetButtonRegionList_d} width="90%" />
        </p>
        <p>
            In CARTA, there are two kinds of objects that you can create in the Image Viewer:
            <ul>
                <li>Region of interest: this kind of object can be used as a reference to derive image analytics.</li>
                <li>Image annotation: this kind of object can be used to decorate your image for presentation purposes only.</li>
            </ul>
            Regions and annotations share most of their attributes. The only difference is that annotations cannot be used as a reference for image analytics computations. In the following section, we use "region" as a shorthand for both
            objects to introduce features.
        </p>
        <p>
            The Region List Widget shows you a list of regions created via the graphical user interface or loaded via the menu (<b>File -&gt; Import Regions</b>) or the <b>Import</b> button in the bottom-right corner of the widget. The
            basic information of a region is provided in the list. The active region is highlighted in the list and region control points are visible in the Image Viewer. To de-select a region, press the <code>Esc</code> key.
        </p>
        <p>
            <code>double-click</code> on a list entry or on a region in the Image Viewer to bring up the Region Configuration Dialog, where you can adjust region appearance and region properties.
        </p>
        <p>
            The <b>Lock</b> button in each region entry can be used to prevent editing a region accidentally. Locked regions will appear slightly dimmer in the Image Viewer. In the top-left corner of the widget, you can use the <b>Lock</b>{" "}
            button to lock all regions at once. The <b>Focus</b> button is used to center a region in the current field of view of the Image Viewer. If there are many regions that block the image view, you can use the <b>Hide</b> button at
            the top-left corner of the widget to temporarily hide regions. There are two levels of hiding: one makes regions semi-transparent and the other makes regions completely transparent.
        </p>
        <p>
            You can save a region as a text file with the <b>Export</b> button. You may also export all regions via the <b>Export</b> button in the bottom-right corner of the widget. In the region export file browser, you may select only a
            subset of the regions and save them as a region text file.
        </p>
        <p>
            To delete an active (selected) region, press <code>delete</code> or <code>backspace</code> key.
        </p>
        <p>
            Unmatched images can have their own sets of regions. If an image is spatially matched to the spatial reference image, a union set of regions is created and registered to the reference image. This new set of regions is shared to
            all spatially matched images. Shared regions are approximated as polygon regions, so on the spatially matched images you may see region distortion as a result of projection. However, the region sky coverages on the reference and
            matched images are approximately the same, allowing a fair comparison of their region analytics. If a matched image is unmatched from the spatial reference image, a copy of the region set from the spatial reference image is
            created and registered to the unmatched image.
        </p>
    </div>
);
