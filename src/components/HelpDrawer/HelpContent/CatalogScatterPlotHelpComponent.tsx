import * as React from "react";

export class CatalogScatterPlotHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>The Catalog 2D scatter plot widget shows a 2D scatter 
                    plot of two numeric columns of a catalog file. The 
                    available numeric columns are determined by the 
                    &quot;Display&quot; column of the upper table in the 
                    Catalog widget.</p>
                <p>The data used for plotting the 2D scatter is determined 
                    by the lower table in the Catalog widget. The table may not 
                    show all entries due to the dynamic loading feature. Thus, 
                    the histogram plot may not include all entries 
                    (after filtering). The &quot;Plot All&quot; button will 
                    request a full download of all entries and the histogram plot 
                    will then include all entries (after filtering).</p>
                <p>By clicking on a point or using the selection tools from the 
                    top-right corner of the plot, selected sources will be highlighted 
                    in the source catalog table, in the histogram plot (if exists), 
                    and in the image viewer (if the catalog overlay is enabled). 
                    Points on the plot will be highlighted if sources are selected 
                    in the source catalog table, in the histogram plot (if exists), 
                    and in the image viewer (if the catalog overlay is enabled). 
                    The &quot;Show only selected sources&quot; toggle will update 
                    the source catalog table to show only the selected sources.</p>        
            </div>
        );
    }
}
