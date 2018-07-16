import * as React from "react";
import * as ReactDOM from "react-dom";
import {App} from "./App";
import {AppStore} from "./stores/AppStore";

it("renders without crashing", () => {
    const appStore = new AppStore();
    const div = document.createElement("div");
    ReactDOM.render(<App appStore={appStore}/>, div);
    ReactDOM.unmountComponentAtNode(div);
});
