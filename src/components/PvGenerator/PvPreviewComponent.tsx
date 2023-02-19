import {observer} from "mobx-react";

import { ImagePanelComponent } from "components/ImageView/ImagePanel/ImagePanelComponent";
import { WidgetsStore } from "stores";


interface PVPreviewDialogProps {
    id: string;
    docked: boolean;
    floatingSettingsId: string;
}

const PvPreview = observer((props: PVPreviewDialogProps) => {

    // <RasterViewComponent frame={WidgetsStore?.Instance.pvGeneratorWidgets?.get(props.id)?.previewFrame} docked={false} pixelHighlightValue={NaN} row={0} column={0} />
    // <OverlayComponent frame={WidgetsStore?.Instance.pvGeneratorWidgets?.get(props.id)?.previewFrame} overlaySettings={AppStore.Instance.overlayStore} docked={false} />
    return (
        <ImagePanelComponent key={props.id} docked={false} frame={WidgetsStore?.Instance.pvGeneratorWidgets?.get(props.id)?.previewFrame} row={0} column={0} />  
    );
});


export const PvPreviewComponent = Object.assign(PvPreview, {WIDGET_CONFIG: {
    id: "pv-preview",
    type: "pv-preview",
    minWidth: 350,
    minHeight: 500,
    defaultWidth: 500,
    defaultHeight: 620,
    title: "PV Preview Viewer",
    isCloseable: true,
    parentId: 'pv-generator',
    parentType: 'pv-generator'
}});