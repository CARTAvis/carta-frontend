import {ImageComponent} from "../ImageComponent";
import widgetButtonRegionList from "static/help/widgetButton_regionList.png";
import widgetButtonRegionList_d from "static/help/widgetButton_regionList_d.png";

export const REGION_LIST_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={widgetButtonRegionList} dark={widgetButtonRegionList_d} width="90%" />
        </p>
        <p>
            The region list widget shows you a list of regions created via the graphical user interface and loaded via region import (<strong>File</strong> -&gt; <strong>Import regions</strong>). The basic information of a region is
            provided in the list. The active region is highlighted in the list and region control points are visible in the image viewer. To de-select a region, press the <code>Esc</code> key.
        </p>
        <p>
            <code>double-click</code> on a list entry or on a region in the image viewer to bring up the region configuration dialog, where you can adjust region appearance and region properties.
        </p>
        <p>
            The <code>Lock</code> button for each region entry is used to prevent editing a region accidentally. Locked regions will appear slightly dimmer in the image viewer. The <code>Focus</code> button is used to center a region in the current
            field of view of the image viewer. You can save a region as a text file with the <code>Export</code> button. You may also export all regions via the <code>Export all</code> button at the top of the list. In the region export
            file browser, you can also select only a subset of the regions and save them as a region text file.
        </p>
        <p>
            To delete an active (selected) region, press <code>delete</code> or <code>backspace</code> key.
        </p>
        <p>
            Unmatched images can have their own sets of regions. If an image is spatially matched to the spatial reference image, a union set of regions is created and registered to the reference image. This new set of regions is
            shared to all spatially matched images. Shared regions are approximated as polygon regions, so on the spatially matched images we may see region distortion as a result of projection. However, the region sky coverages on the
            reference and matched images are approximately the same, allowing a fair comparison of their region analytics. If a matched image is unmatched from the spatial reference image, a copy of the region set from the spatial reference
            image is created and registered to the unmatched image.
        </p>
    </div>
);
