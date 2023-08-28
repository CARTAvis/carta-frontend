export const CATALOG_HISTOGRAM_PLOT_HELP_CONTENT = (
    <div>
        <p>
            The Catalog Histogram Plot Widget offers a dynamic visualization of a histogram derived from a chosen numeric column within a catalog file. The available numeric columns for plotting are determined by the "Display" column of the
            upper table within the Catalog Widget.
        </p>
        <p>
            The data used for plotting a histogram is determined by the lower table within the Catalog Widget. Due to the progressive loading mechanism, not all entries may be immediately visible within the table. As you navigate through
            the catalog table, new entries are progressively loaded to facilitate table visualization. Consequently, it's important to note that when initializing the widget, the histogram plot might not encompass all entries (even
            post-filtration). The <b>Plot</b> button in the Catalog Histogram Plot Widget enables you to trigger a full download of all entries. This ensures that the histogram plot incorporates the complete dataset post-filtration.
            Flexibility is granted in terms of selecting a catalog file (<b>File</b> dropdown) and a column therein (<b>X</b> dropdown), configuring the number of bins (<b>Bins</b> input field) and selecting the y-axis scale (linear or
            logarithmic; <b>Log scale</b> toggle).
        </p>
        <p>
            The <b>Statistic source</b> dropdown menu lets you select a numeric column from the catalog, prompting the display of fundamental statistical metrics. This includes data count, mean, root mean square (rms), standard deviation,
            minimum, and maximum values.
        </p>
        <p>
            A highlight of this widget is its interactive nature: selecting a specific histogram bin results in the corresponding source entries being highlighted across multiple panels – in the source catalog table, the 2D scatter plot (if
            applicable), and the Image Viewer (when the catalog overlay feature is activated). Reciprocally, if source entries within a bin are chosen in the source catalog table, 2D scatter plot, or Image Viewer (catalog overlay enabled),
            the associated histogram bin becomes highlighted. The <b>Selected only</b> toggle simplifies the source catalog table by revealing solely the chosen sources.
        </p>
    </div>
);
