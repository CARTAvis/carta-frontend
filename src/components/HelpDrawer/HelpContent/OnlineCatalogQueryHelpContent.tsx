import dialogButtonOnlineCatalogQuery from "static/help/dialogButton_catalogQuery.png";
import dialogButtonOnlineCatalogQuery_d from "static/help/dialogButton_catalogQuery_d.png";

import {ImageComponent} from "../ImageComponent";

export const ONLINE_CATALOG_QUERY_HELP_CONTENT = (
    <div>
        <p>
            <ImageComponent light={dialogButtonOnlineCatalogQuery} dark={dialogButtonOnlineCatalogQuery_d} width="39%" />
        </p>
        <p>
            With the Online Catalog Query Dialog, you can fetch source catalogs from{" "}
            <a href="http://simbad.u-strasbg.fr" target="_blank" rel="noreferrer">
                SIMBAD
            </a>{" "}
            or{" "}
            <a href="https://vizier.u-strasbg.fr/viz-bin/VizieR" target="_blank" rel="noreferrer">
                VizieR
            </a>
            . Once a catalog is retrieved, it is displayed in the Catalog Widget where you can apply filtering or trigger catalog rendering.
        </p>
        <p>
            You may enter an object name in the <b>Object</b> field to be resolved by SIMBAD. If the object is resolved, the <b>Center Coordinates</b> fields are updated automatically. Alternatively, you may define a coordinate manually or
            use the <b>Set center</b> button (the "target" icon) to set the center coordinate in the active image view as the center to search for source catalogs. The search radius can be defined with the input field or with the{" "}
            <b>Set to view</b> button which adopts the field of view of the active image view.
        </p>
        <p>
            If the database is VizieR, you may additionally supply catalog keywords in the <b>Keywords</b> field for the query. After you have clicked the <b>Query</b> button, a set of catalog <em>titles</em> will be displayed once you
            click the <b>VizieR catalog</b> field. You can then select the desired catalog titles (multi-selection) and click the <b>Load selected</b> button to retrieve corresponding source catalogs.
        </p>
        <p>
            Sometimes the query process takes some time. You may click the <b>Cancel</b> button if you wish to abort the query.
        </p>
    </div>
);
