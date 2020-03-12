import * as React from "react";
import * as underConstruction from "static/help/under_construction.png";

export class SaveLayoutHelpComponent extends React.Component {
    public render() {
        return (
            <div>
                <p>With this dialogue, the current layout can be saved and re-used in the future. The widgets in a layout can be either docked or undocked.</p>
                <h3 id="layout-management">Layout management</h3>
                <p>Load a preset layout or a custom layout: <strong>Layout</strong> -&gt; <strong>Layouts</strong> -&gt; <strong>Existing layouts</strong></p>
                <p>Set a layout as the default layout: <strong>File</strong> -&gt; <strong>Preferences</strong> -&gt; <strong>Global</strong> tab -&gt; <strong>Initial layout</strong>.</p>
                <p>Delete a custom layout: <strong>Layout</strong> -&gt; <strong>Layouts</strong> -&gt; <strong>Delete layouts</strong>.</p>

            </div>
        );
    }
}
