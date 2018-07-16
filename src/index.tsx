import * as React from "react";
import * as ReactDOM from "react-dom";

import App from "./App";
import "./index.css";
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import "./layout-base.css";
import "./layout-theme.css";
import registerServiceWorker from "./registerServiceWorker";
import {AppStore} from "./stores/AppStore";

// GoldenLayout requires these in the global namespace
window["React"] = React; // tslint:disable-line
window["ReactDOM"] = ReactDOM; // tslint:disable-line

const appStore = new AppStore();

ReactDOM.render(
    <App appStore={appStore}/>,
    document.getElementById("root") as HTMLElement
);
registerServiceWorker();
