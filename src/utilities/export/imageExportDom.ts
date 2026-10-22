import {LayoutStore} from "stores";

/**
 * Search for an element by id in the main document and all FlexLayout popout
 * windows' documents. This is needed because when a widget is rendered in a
 * FlexLayout popout the DOM lives in a different document from the main window.
 */
export function findElementInAllDocuments(id: string): HTMLElement | null {
    const el = document.getElementById(id);
    if (el) {
        return el;
    }
    const model = LayoutStore.Instance.layoutModel;
    if (model) {
        for (const [, layoutConfig] of model.getLayouts()) {
            const win = layoutConfig.getWindow();
            if (win && !win.closed) {
                const found = win.document.getElementById(id);
                if (found) {
                    return found;
                }
            }
        }
    }
    return null;
}
