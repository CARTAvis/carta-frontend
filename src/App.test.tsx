import * as React from "react";
import * as ReactDOM from "react-dom";
import App from "./App";
import {AppState} from "./states/AppState";

it("renders without crashing", () => {
    const appState = new AppState();
    const div = document.createElement("div");
    ReactDOM.render(<App appState={appState}/>, div);
    ReactDOM.unmountComponentAtNode(div);
});
