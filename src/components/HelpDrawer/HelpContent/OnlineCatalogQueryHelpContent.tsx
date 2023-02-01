import dialogButtonOnlineCatalogQuery from "static/help/dialogButton_catalogQuery.png";
import dialogButtonOnlineCatalogQuery_d from "static/help/dialogButton_catalogQuery_d.png";

import {ImageComponent} from "../ImageComponent";

export const ONLINE_CATALOG_QUERY_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={dialogButtonOnlineCatalogQuery} dark={dialogButtonOnlineCatalogQuery_d} width="39%" />
        </p>
        <p>
            With the online catalog query dialog, you can fetch source catalogs from{" "}
            <a href="http://simbad.u-strasbg.fr" target="_blank" rel="noreferrer">
                SIMBAD
            </a>{" "}
            or{" "}
            <a href="https://vizier.u-strasbg.fr/viz-bin/VizieR" target="_blank" rel="noreferrer">
                VizieR
            </a>
            . Once a catalog is retrieved, it is displayed with the catalog widget where you can apply filtering or trigger catalog rendering.
        </p>
        <p>
            You may enter an object name in the <code>Object</code> field to be resolved by SIMBAD. If the object is resolved, the <code>Center Coordinates</code> fields are updated automatically. Alternatively, you may define a coordinate
            manually or use the <code>Set center</code> button to set the center coordinate in the active image view as the center to search for source catalogs. The search radius can be defined with the text field or with the{" "}
            <code>Set to view</code> button which adopts the field of view of the active image view.
        </p>
        <p>
            If the database is VizieR, after you have clicked the <code>Query</code> button, a set of catalog <em>titles</em> will be displayed once you click the <code>VizieR Catalog</code> field. You can then select the desired catalog
            titles (multiple selection) and click the <code>Load selected</code> button to retrieve corresponding source catalogs.
        </p>
        <p>
            Sometimes the query process takes some time. You may click the <code>Cancel</code> button if you wish to abort the query.
        </p>
    </div>
);
