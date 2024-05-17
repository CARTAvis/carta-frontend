import {DialogProps} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore, DialogId, HelpType} from "stores";

import {CatalogQueryDialogComponent} from "./CatalogOnlineQueryDialogComponent";

const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 550;
const MIN_WIDTH = 550;
const MIN_HEIGHT = 450;

export const OnlineDataQueryDialogComponent = observer(() => {
    const appStore = AppStore.Instance;

    let className = "catalog-query-dialog";
    if (appStore.darkTheme) {
        className += " bp3-dark";
    }

    const dialogProps: DialogProps = {
        icon: "geosearch",
        className: className,
        backdropClassName: "minimal-dialog-backdrop",
        canOutsideClickClose: false,
        lazy: true,
        isOpen: appStore.dialogStore.dialogVisible.get(DialogId.CatalogQuery),
        title: "Online Catalog Query"
    };

    return (
        <DraggableDialogComponent
            dialogProps={dialogProps}
            helpType={HelpType.ONLINE_CATALOG_QUERY}
            defaultWidth={DEFAULT_WIDTH}
            defaultHeight={DEFAULT_HEIGHT}
            minWidth={MIN_WIDTH}
            minHeight={MIN_HEIGHT}
            enableResizing={true}
            dialogId={DialogId.CatalogQuery}
        >
            <CatalogQueryDialogComponent />
        </DraggableDialogComponent>
    );
});
