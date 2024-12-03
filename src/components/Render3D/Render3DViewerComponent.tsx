import React from "react";
import ReactResizeDetector from "react-resize-detector";
import {observer} from "mobx-react";

import {ImagePanelComponent} from "components/ImageView/ImagePanel/ImagePanelComponent";
import {ImageType} from "models";
import {DefaultWidgetConfig, WidgetsStore} from "stores";

interface Render3DViewerDialogProps {
    id: string;
    docked: boolean;
    floatingSettingsId?: string;
}

@observer
export class Render3DViewerComponent extends React.Component<Render3DViewerDialogProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "render3d-viewer",
            type: "render3d-viewer",
            minWidth: 300,
            minHeight: 300,
            defaultWidth: 600,
            defaultHeight: 600,
            title: "3D Rendering Viewer",
            isCloseable: true,
            parentId: "render3d",
            parentType: "render3d"
        };
    }

    public render() {
        const frame = WidgetsStore?.Instance.render3DWidgets?.get(this.props.id)?.render3DFrame;

        return (
            <>
                <ImagePanelComponent key={this.props.id} docked={false} image={{type: ImageType.PV_PREVIEW, store: frame}} row={0} column={0} />;
                <ReactResizeDetector handleWidth handleHeight onResize={frame.onResizePreviewWidget} refreshMode={"throttle"} refreshRate={33}></ReactResizeDetector>
            </>
        );
    }
}
