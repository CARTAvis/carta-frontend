export const CATALOG_HISTOGRAM_PLOT_HELP_CONTENT = (
    <div>
        <p>
            The Catalog histogram plot widget offers a dynamic visualization of a histogram derived from a chosen numeric column within a catalog file. The selection of viable numeric columns available for plotting is influenced by the
            "Display" column located in the upper table of the Catalog widget.
        </p>
        <p>
            The histogram plotting process is contingent upon the data showcased in the lower table of the Catalog widget. Due to the progressive loading mechanism, not all entries may be immediately visible within the table. As you
            navigate through the catalog table, new entries are progressively loaded to facilitate visualization. Consequently, it's important to note that when initializing the widget, the histogram plot might not encompass all entries
            (even post-filtration). The "Plot" button emerges as a solution, enabling you to trigger a full download of all entries. This ensures that the histogram plot incorporates the complete dataset post-filtration. Flexibility is
            granted in terms of configuring the number of bins and selecting the y-axis scale (linear or logarithmic).
        </p>
        <p>
            The "Statistic source" dropdown menu lets you select a numeric column from the catalog, prompting the display of fundamental statistical metrics. This includes data count, mean, root mean square (rms), standard deviation,
            minimum, and maximum values.
        </p>
        <p>
            A highlight of this widget is its interactive nature: selecting a specific histogram bin results in the corresponding source entries being highlighted across multiple panels – in the source catalog table, the 2D scatter plot (if
            applicable), and the image viewer (when the catalog overlay feature is activated). Reciprocally, if source entries within a bin are chosen in the source catalog table, 2D scatter plot, or image viewer (catalog overlay enabled),
            the associated histogram bin becomes highlighted. The "Selected only" toggle simplifies the source catalog table by revealing solely the chosen sources.
        </p>
    </div>
);
