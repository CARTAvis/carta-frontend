import * as React from "react";
import "./ImageViewComponent.css";
import {AppState} from "../../Models/AppState";
import {observer} from "mobx-react";
import ReactResizeDetector from "react-resize-detector";
import {NonIdealState, Spinner} from "@blueprintjs/core";
import {OverlayComponent} from "./Overlay/OverlayComponent";

@observer
export class ImageViewComponent extends React.Component<{ appState: AppState }, { width: number, height: number }> {

    constructor(props: { appState: AppState }) {
        super(props);
        this.state = {width: 0, height: 0};
    }

    onResize = (width: number, height: number) => {
        this.setState({width, height});
    };

    render() {
        const appState = this.props.appState;
        return (
            <div style={{width: "100%", height: "100%"}}>
                {appState.astReady &&
                <OverlayComponent astReady={appState.astReady} width={this.state.width} height={this.state.height} settings={appState.overlaySettings}/>
                }
                {!appState.astReady &&
                <NonIdealState visual={<Spinner className="astLoadingSpinner"/>} title="Loading AST Library"/>
                }
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}