export const CATALOG_SCATTER_PLOT_HELP_CONTENT = (
    <div>
        <p>
            The Catalog 2D Scatter Plot widget serves as a dynamic canvas for visualizing a scatter plot generated from two chosen numeric columns within a catalog file. The dropdown menus located at the widget's lower section provide a
            selection of available numeric columns. These options are driven by the "Display" column present in the upper table of the Catalog widget.
        </p>
        <p>
            The process of rendering a 2D scatter plot is informed by the data enlisted in the lower table of the Catalog widget. As a result of the progressive loading mechanism, not all catalog entries may be instantly viewable within the
            table. As you navigate through the catalog, new entries are continuously loaded to facilitate visualization. Thus, it's worth noting that during the widget's initialization, the 2D scatter plot might not encompass all entries
            (even post-filtration). To address this, the "Plot" button facilitates a comprehensive download of all entries. Subsequently, the 2D scatter plot incorporates the complete dataset after applying any filters.
        </p>
        <p>
            The "Statistic source" dropdown menu offers the ability to select a numeric column from the catalog, enabling the display of essential statistical metrics such as data count, mean, root mean square (rms), standard deviation,
            minimum, and maximum values.
        </p>
        <p>
            Interactivity is a highlight of this widget: you can click on individual points or employ selection tools (Box Select or Lasso Select) situated at the top-right corner of the plot. This action serves to highlight chosen sources
            in the source catalog table, the histogram plot (if applicable), and the image viewer (if catalog overlay is enabled). Reciprocally, if sources are selected in the source catalog table, histogram plot (when available), or image
            viewer (catalog overlay enabled), corresponding points on the plot become highlighted. The "Selected only" toggle streamlines the source catalog table by revealing solely the chosen sources.
        </p>
        <p>
            An additional feature, the "Linear fit" button, allows you to perform a linear regression (1st-order polynomial fit) on the data. The outcomes of the fit are concisely summarized in the top-left corner of the scatter plot. By
            utilizing the selection tools at the plot's top-right corner, you can select a specific subset of data for the linear fit. If no specific data subset is chosen, the entire dataset is employed for the linear fit.
        </p>
    </div>
);
