import React from "react";
import {observer} from "mobx-react";

import {ImagePanelComponent} from "components/ImageView/ImagePanel/ImagePanelComponent";
import {ResizeDetector} from "components/Shared";
import {ImageType} from "models";
import {DefaultWidgetConfig, WidgetsStore} from "stores";

import "./PvPreviewComponent.scss";

interface PVPreviewDialogProps {
    id: string;
    docked: boolean;
    floatingSettingsId?: string;
}

@observer
export class PvPreviewComponent extends React.Component<PVPreviewDialogProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "pv-preview",
            type: "pv-preview",
            minWidth: 500,
            minHeight: 350,
            defaultWidth: 500,
            defaultHeight: 620,
            title: "PV Preview Viewer",
            isCloseable: true,
            parentId: "pv-generator",
            parentType: "pv-generator"
        };
    }

    public render() {
        const frame = WidgetsStore?.Instance.pvGeneratorWidgets?.get(this.props.id)?.previewFrame;

        return (
            <ResizeDetector onResize={WidgetsStore?.Instance.pvGeneratorWidgets?.get(this.props.id)?.onResizePreviewWidget} throttleTime={33}>
                <div className="pv-preview-widget">
                    <ImagePanelComponent key={this.props.id} docked={false} image={{type: ImageType.PV_PREVIEW, store: frame}} row={0} column={0} />
                </div>
            </ResizeDetector>
        );
    }
}
