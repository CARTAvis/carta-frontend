import {DialogId} from "enums";
import {AppStore, DialogStore, WidgetConfig, WidgetsStore} from "stores";

describe("WidgetsStore floating widgets", () => {
    const widgetsStore = WidgetsStore.Instance;
    const zIndexManager = AppStore.Instance.zIndexManager;

    const catalogPlot = () =>
        new WidgetConfig("catalog-plot-1", {id: "catalog-plot", type: "catalog-plot", componentId: "catalog-plot-0", minWidth: 1, minHeight: 1, defaultWidth: 1, defaultHeight: 1, isCloseable: true, title: "Catalog plot"});

    afterEach(() => {
        widgetsStore.floatingWidgets.slice().forEach(widget => widgetsStore.removeFloatingWidget(widget.id, true));
        DialogStore.Instance.hideDialog(DialogId.Workspace);
    });

    test("removes a catalog plot from the stack when the floating widgets are removed", () => {
        widgetsStore.addFloatingWidget(catalogPlot());
        widgetsStore.removeFloatingWidgets();
        expect(zIndexManager.findIndex("catalog-plot-0")).toBe(0);
    });

    test("opens a dialog above a catalog plot that replaced an earlier one", () => {
        widgetsStore.addFloatingWidget(catalogPlot());
        widgetsStore.removeFloatingWidgets();
        widgetsStore.addFloatingWidget(catalogPlot());
        DialogStore.Instance.showDialog(DialogId.Workspace);
        expect(zIndexManager.findIndex(DialogId.Workspace)).toBeGreaterThan(zIndexManager.findIndex("catalog-plot-0"));
    });
});
