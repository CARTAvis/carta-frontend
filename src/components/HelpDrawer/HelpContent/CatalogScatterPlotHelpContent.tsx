export const CATALOG_SCATTER_PLOT_HELP_CONTENT = (
    <div>
        <p>
            The Catalog 2D Scatter Plot Widget serves as a dynamic canvas for visualizing a scatter plot generated from two chosen numeric columns within a catalog file. The dropdown menus located at the lower section of the Catalog Widget
            provide a selection of available numeric columns. These options are driven by the "Display" column present in the upper table of the Catalog Widget.
        </p>
        <p>
            The data used for rendering a 2D scatter plot is determined by the lower table in the Catalog Widget. As a result of the progressive loading mechanism, not all catalog entries may be instantly viewable within the table. As you
            navigate through the catalog, new entries are continuously loaded to facilitate visualization. Thus, it's worth noting that during the widget's initialization, the 2D scatter plot might not encompass all entries (even
            post-filtration). To address this, the <b>Plot</b> button in the Catalog 2D Scatter Plot Widget facilitates a download of all entries. Subsequently, the 2D scatter plot incorporates the complete dataset after applying any
            filters.
        </p>
        <p>
            When there are multiple catalog files loaded, you can use the <b>File</b> dropdown menu to select a target catalog and use the <b>X</b> and <b>Y</b> dropdown menus to identify two numeric columns therein for 2D scatter plot
            visualization. The <b>Statistic source</b> dropdown menu offers the ability to select a numeric column from the catalog, enabling the display of essential statistical metrics such as data count, mean, root mean square (rms),
            standard deviation, minimum, and maximum values.
        </p>
        <p>
            Interactivity is a highlight of this widget: you can click on individual points or employ selection tools (<b>Box select</b> or <b>Lasso select</b>) located at the top-right corner of the plot. This action serves to highlight
            chosen sources in the source catalog table, the histogram plot (if applicable), and the Image Viewer (if catalog overlay is enabled). Reciprocally, if sources are selected in the source catalog table, histogram plot (when
            available), or image viewer (catalog overlay enabled), corresponding points on the plot become highlighted. The <b>Selected only</b> toggle simplifies the source catalog table by revealing solely the chosen sources.
        </p>
        <p>
            An additional feature, the <b>Linear fit</b> button, allows you to perform a linear regression (1st-order polynomial fit) on the data. The outcomes of the fit are summarized at the top-left corner of the scatter plot. By
            utilizing the selection tools (e.g., <b>Box select</b>) at the plot's top-right corner, you can select a specific subset of data for the linear fit. If no specific data subset is chosen, the entire dataset is adopted for the
            linear fit.
        </p>
    </div>
);
