import * as React from "react";

export class CatalogHistogramPlotHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>The Catalog histogram plot widget shows a histogram of a numeric column 
                    of a catalog file. The available numeric columns are determined by the 
                    &quot;Display&quot; column of the upper table in the Catalog widget.</p>
                <p>The data used for plotting the histogram is determined by the lower table 
                    in the Catalog widget. The table may not show all entries due to the dynamic 
                    loading feature. Thus, the histogram plot may not include all entries 
                    (after filtering). The &quot;Plot All&quot; button will request a full 
                    download of all entries and the histogram plot will then include all 
                    entries (after filtering). The number of bins and the scale of the 
                    y-axis can be customized.</p>
                <p>By clicking on a certain histogram bin, source entries of that bin will be 
                    highlighted in the source catalog table, in the 2D scatter plot (if exists), 
                    and in the image viewer (if the catalog overlay is enabled). A certain 
                    histogram bin will be highlighted if source entries of that bin are selected 
                    in the source catalog table, in the 2D scatter plot (if exists), and in the 
                    image viewer (if the catalog overlay is enabled). The &quot;Show only selected sources&quot; 
                    toggle will update the source catalog table to show only the selected sources.</p>        
            </div>
        );
    }
}
