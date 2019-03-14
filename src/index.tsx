import * as React from "react";
import * as ReactDOM from "react-dom";
import {FocusStyleManager} from "@blueprintjs/core";
import {App} from "./App";
import {AppStore} from "./stores";
import registerServiceWorker from "./registerServiceWorker";
import "./index.css";
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import "./layout-base.css";

// Pre-load static assets
import allMaps from "./static/allmaps.png";
import linearPng from "./static/equations/linear.png";
import logPng from "./static/equations/log.png";
import sqrtPng from "./static/equations/sqrt.png";
import squaredPng from "./static/equations/squared.png";
import gammaPng from "./static/equations/gamma.png";
import powerPng from "./static/equations/power.png";

for (const val of [allMaps, linearPng, logPng, sqrtPng, squaredPng, gammaPng, powerPng]) {
    new Image().src = val;
}

// Remove focus on tabs
FocusStyleManager.onlyShowFocusOnTabs();

// GoldenLayout requires these in the global namespace
window["React"] = React; // tslint:disable-line
window["ReactDOM"] = ReactDOM; // tslint:disable-line

const appStore = new AppStore();

ReactDOM.render(
    <App appStore={appStore}/>,
    document.getElementById("root") as HTMLElement
);

registerServiceWorker();
