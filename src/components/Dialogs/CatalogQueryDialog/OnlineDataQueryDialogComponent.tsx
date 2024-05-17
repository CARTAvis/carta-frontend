import {DialogProps} from "@blueprintjs/core";
import classNames from "classnames";
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

    const className = classNames("catalog-query-dialog", {"bp3-dark": appStore.darkTheme});

    const dialogProps: DialogProps = {
        icon: "geosearch",
        className: className,
        backdropClassName: "minimal-dialog-backdrop",
        canOutsideClickClose: false,
        lazy: true,
        isOpen: appStore.dialogStore.dialogVisible.get(DialogId.OnlineDataQuery),
        title: "Online Data Query"
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
            dialogId={DialogId.OnlineDataQuery}
        >
            <CatalogQueryDialogComponent />
        </DraggableDialogComponent>
    );
});
