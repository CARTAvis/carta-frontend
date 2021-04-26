import * as React from "react";
import {ImageComponent} from "./ImageComponent";
import headCatalogueButton from "static/help/head_catalogue_button.png";
import headCatalogueButton_d from "static/help/head_catalogue_button_d.png";

export class CatalogOverlayHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p><ImageComponent light={headCatalogueButton} dark={headCatalogueButton_d} width="90%"/></p>
                <p>Source catalogue files in the VOTable or FITS format can be loaded in CARTA (via &quot;File&quot;-&gt; &quot;Import catalog&quot;) for visualization as an image overlay, or a 2D scatter plot, or a histogram.</p>
                <p>Once a source catalogue file is loaded, the information of each column will be shown in the upper table, while the actual catalogue entries are displayed in the lower table. By default, only the first 10 columns are
                    enabled and displayed. Users may configure it to show or hide certain columns to be displayed in the lower table.</p>
                <p>Depending on the rendering type defined (via a dropdown) in the top bar, the &quot;Represent As&quot; column allows users to set which columns are used for visualization. If the rendering type is &quot;Image
                    overlay&quot;, the content of the dropdown of the &quot;Represent As&quot; column is determined by the &quot;System&quot; dropdown. Users need to tell CARTA which coordinate system the source catalogue file refers to.
                    Source catalogue defined in image coordinate (0-based or 1-based) is also supported. Two numeric columns are required to render the source catalogue as an &quot;Image overlay&quot;. If the rendering type
                    is &quot;Histogram&quot;, one numeric column is required. If the rendering type is &quot;2D scatter&quot;, two numeric columns are needed.</p>
                <p>The source catalogue table accepts sub-filters such as partial string match or value range. For numeric columns, supported operators are:</p>
                <ul>
                    <li><code>&gt;</code> greater than</li>
                    <li><code>&gt;=</code> greater than or equal to</li>
                    <li><code>&lt;</code> less than</li>
                    <li><code>&lt;=</code> less than or equal to</li>
                    <li><code>==</code> equal to</li>
                    <li><code>!=</code> not equal to</li>
                    <li><code>..</code> between (exclusive)</li>
                    <li><code>...</code> between (inclusive)</li>
                </ul>
                <p>Examples:</p>
                <ul>
                    <li><code>&lt; 10</code> (everything less than 10)</li>
                    <li><code>== 1.23</code> (entries equal to 1.23)</li>
                    <li><code>10..50</code> (everything between 10 and 50, exclusive)</li>
                    <li><code>10...50</code> (everything between 10 and 50, inclusive)</li>
                </ul>
                <p>For string columns, partial match is adopted. For example, <code>gal</code> (no quotation) will return entries containing the &quot;gal&quot; string.</p>
                <p>Once filters are set, by clicking the &quot;Update&quot; the filters will be applied and a filtered source catalogue will be displayed up to a number of entries defined in the &quot;Max Rows&quot; text input field. When
                    the &quot;Reset&quot; button is clicked, all filters will be removed and the image overlay (if exists) will be removed too. For the histogram plot or the 2D scatter plot, the plot will be reset so that only the first 50
                    entries are rendered.</p>
                <p>The source catalogue table, the image overlay, the 2D scatter plot, and the histogram plot are inter-linked or cross-referenced. This means, for example, selecting a source or a set of source in the catalogue table will
                    trigger source highlight in other places. Or, selecting a source or a set of sources in the 2D scatter plot will trigger source highlight in other plots and in the catalogue table.</p>
                <p>Multiple catalogue files can be loaded and users may use the &quot;File&quot; dropdown at the top of the widget to switch in between. Multiple catalogue widgets may be launched to display different catalogue files.
                    The &quot;Close&quot; button at the bottom of the widget will close the selected catalogue file in the &quot;File&quot; dropdown.</p>
            </div>
        );
    }
}
