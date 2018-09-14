import * as React from "react";
import * as ReactDOM from "react-dom";

import {App} from "./App";
import "./index.css";
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import {FocusStyleManager} from "@blueprintjs/core";
import "./layout-base.css";
import registerServiceWorker from "./registerServiceWorker";
import {AppStore} from "./stores/AppStore";

// Pre-load static assets
import allMaps from "./static/allmaps.png";
import linearSvg from "./static/equations/linear.svg";
import logSvg from "./static/equations/log.svg";
import sqrtSvg from "./static/equations/sqrt.svg";
import squaredSvg from "./static/equations/squared.svg";
import gammaSvg from "./static/equations/gamma.svg";

for (const val of [allMaps, linearSvg, logSvg, sqrtSvg, squaredSvg, gammaSvg]) {
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
