import * as React from "react";
import "./ImageViewComponent.css";
import {AppState} from "../../Models/AppState";
import {observer} from "mobx-react";
import ReactResizeDetector from "react-resize-detector";
import {NonIdealState, Overlay, Spinner} from "@blueprintjs/core";
import {OverlayComponent} from "./Overlay/OverlayComponent";
import {CursorInfo} from "../../Models/CursorInfo";
import {Point2D} from "../../Models/Point2D";

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
        return (
            <div style={{width: "100%", height: "100%"}} ref={(ref) => this.containerDiv = ref}>
                {appState.astReady &&
                <OverlayComponent
                    wcsInfo={appState.wcsInfo}
                    width={this.state.width}
                    height={this.state.height}
                    overlaySettings={appState.overlaySettings}
                    onCursorMoved={this.onCursorMoved}
                />
                }
                {appState.astReady &&
                <Overlay isOpen={true} hasBackdrop={false}>
                    <div
                        style={{
                            backgroundColor: "#ff000010",
                            top: (this.containerDiv.getBoundingClientRect().bottom - 25) + "px",
                            width: this.state.width + "px",
                            height: "25px"
                        }}
                    >
                        {appState.cursorInfo ? `WCS: (${appState.cursorInfo.infoWCS.x}, ${appState.cursorInfo.infoWCS.y}); Image: (${appState.cursorInfo.posImageSpace.x.toFixed(0)}, ${appState.cursorInfo.posImageSpace.y.toFixed(0)})` : ""}
                    </div>
                </Overlay>
                }
                {!appState.astReady &&
                <NonIdealState visual={<Spinner className="astLoadingSpinner"/>} title={"Loading AST Library"}/>
                }
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}