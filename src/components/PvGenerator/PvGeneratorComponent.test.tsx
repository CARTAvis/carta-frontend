import * as React from "react";
import {HTMLSelect, Switch} from "@blueprintjs/core";
import {runInAction} from "mobx";

import {AppStore} from "stores";

import {PvGeneratorComponent} from "./PvGeneratorComponent";

/** Returns the props of each element of the tree that has this type. */
function propsOf(node: React.ReactNode, type: unknown, found: any[] = []): any[] {
    if (React.isValidElement(node)) {
        const element = node as React.ReactElement<any>;
        if (element.type === type) {
            found.push(element.props);
        }
        React.Children.forEach(element.props.children, child => propsOf(child, type, found));
    } else if (Array.isArray(node)) {
        node.forEach(child => propsOf(child, type, found));
    }
    return found;
}

describe("PvGeneratorComponent", () => {
    test("shows the keep setting and the preview region of the widget store, such as after a workspace restore", () => {
        const component = new PvGeneratorComponent({id: "pv-generator-0", docked: true} as any);
        const widgetStore = AppStore.Instance.widgetsStore.pvGeneratorWidgets.get("pv-generator-0")!;
        runInAction(() => widgetStore.setKeep(true));

        const tree = component.render();

        expect(propsOf(tree, Switch).map(props => props.checked)).toEqual([true]);
        runInAction(() => widgetStore.setKeep(false));
        expect(propsOf(component.render(), Switch).map(props => props.checked)).toEqual([false]);
        const previewRegionSelect = propsOf(tree, HTMLSelect).find(props => props.onChange === (component as any).handlePreviewRegionChanged);
        expect(previewRegionSelect.value).toBe(widgetStore.effectivePreviewRegionId);
    });
});
