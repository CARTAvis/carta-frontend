import * as React from "react";
import "./ImageViewComponent.css";
import {AppState} from "../../states/AppState";
import {observer} from "mobx-react";
import ReactResizeDetector from "react-resize-detector";
import {NonIdealState, Spinner} from "@blueprintjs/core";
import {OverlayComponent} from "./Overlay/OverlayComponent";
import {CursorInfo} from "../../models/CursorInfo";
import {CursorOverlayComponent} from "./CursorOverlay/CursorOverlayComponent";

@observer
export class ImageViewComponent extends React.Component<{ appState: AppState }, { width: number, height: number }> {

    containerDiv: HTMLDivElement;

    constructor(props: { appState: AppState }) {
        super(props);
        this.state = {width: 0, height: 0};
    }

    onResize = (width: number, height: number) => {
        this.setState({width, height});
    };

    onCursorMoved = (cursorInfo: CursorInfo) => {
        this.props.appState.cursorInfo = cursorInfo;
    };

    render() {
        const appState = this.props.appState;
        const divBounds = this.containerDiv ? this.containerDiv.getBoundingClientRect() : new DOMRect();
        return (
            <div style={{width: "100%", height: "100%"}} ref={(ref) => this.containerDiv = ref}>
                {appState.astReady &&
                <OverlayComponent
                    wcsInfo={(appState.frames.length > appState.activeFrame && appState.frames[appState.activeFrame].valid) ? appState.frames[appState.activeFrame].wcsInfo : 0}
                    width={this.state.width}
                    height={this.state.height}
                    overlaySettings={appState.overlayState}
                    onCursorMoved={this.onCursorMoved}
                />
                }
                {appState.astReady && appState.cursorInfo &&
                <CursorOverlayComponent
                    cursorInfo={appState.cursorInfo}
                    width={this.state.width}
                    bottom={0}
                    showImage={true}
                    showWCS={true}
                    showValue={true}
                />
                }
                {!appState.astReady &&
                <NonIdealState visual={<Spinner className="astLoadingSpinner"/>} title={"Loading AST Library"}/>
                }
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}