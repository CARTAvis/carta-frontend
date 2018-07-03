import {ImageViewComponent} from "../components/ImageView/ImageViewComponent";
import {PlaceholderComponent} from "../components/Placeholder/PlaceholderComponent";
import {action, autorun, computed, observable} from "mobx";
import * as GoldenLayout from "golden-layout";
import * as _ from "lodash";

export class LayoutState {
    // Layout
    @observable layout: GoldenLayout;
    @observable layoutConfig: any;
    maxHistoryQueueLength = 10;
    _layoutHistory: any[] = [];

    @action undoLayoutChange = () => {
        if (!this._layoutHistory || this._layoutHistory.length < 2) {
            return;
        }

        this.layout.destroy();
        const currentLayout = this._layoutHistory.pop();
        const previousLayout = this._layoutHistory.pop();
        this.layout = new GoldenLayout(previousLayout);
        this.layout.registerComponent("placeholder", PlaceholderComponent);
        this.layout.registerComponent("image-view", ImageViewComponent);
        this.layout.init();
        this.layoutConfig = previousLayout;
    };
    @action addLayoutConfigToHistory = (config: any) => {
        if (this._layoutHistory.length > 0) {
            // ignore duplicate configs
            const current = this._layoutHistory[this._layoutHistory.length - 1];
            if (_.isEqual(current, config)) {
                return;
            }

            // if it's a stale config change, replace the latest state with this one, rather than appending
            const diff = difference(current, config);
            if (isStaleChange(diff)) {
                this._layoutHistory.pop();
                this._layoutHistory.push(config);
                return;
            }
        }
        // Check if this layout change is the second step of a compound operation (such as moving from one container to another).
        // If so, we need to remove the previous history step and replace it with this one
        if (this._layoutHistory.length > 1) {
            let itemListCurrent = new Array();
            let itemListPrev = new Array();
            let itemListNew = new Array();

            const current = this._layoutHistory[this._layoutHistory.length - 1];
            const prev = this._layoutHistory[this._layoutHistory.length - 2];
            const next = config;

            appendContentItems(itemListCurrent, current);
            itemListCurrent = itemListCurrent.sort((a, b) => (a.id >= b.id) ? 1 : -1);

            appendContentItems(itemListPrev, prev);
            itemListPrev = itemListPrev.sort((a, b) => (a.id >= b.id) ? 1 : -1);

            appendContentItems(itemListNew, next);
            itemListNew = itemListNew.sort((a, b) => (a.id >= b.id) ? 1 : -1);

            if (itemListPrev.length === itemListNew.length && itemListCurrent.length === itemListNew.length - 1) {
                this._layoutHistory.pop();
            }
        }

        if (this._layoutHistory.length >= this.maxHistoryQueueLength) {
            this._layoutHistory.shift();
        }
        this._layoutHistory.push(config);
        this.layoutConfig = config;
    };

    addStateWatch = autorun(() => {
        if (!this.layout) {
            return;
        }

        this.layout.on("stateChanged", () => {
            if (this.layout.isInitialised) {
                const newConfig = this.layout.toConfig();
                this.addLayoutConfigToHistory(newConfig);
                this.layoutConfig = newConfig;
            }
        });
    });

    @action clearLayoutHistory = () => {
        if (!this._layoutHistory) {
            return;
        }
        this._layoutHistory = [this._layoutHistory.pop()];
        console.log(`Layout history contains ${this._layoutHistory.length} items`);
    };

    @computed get hasLayoutHistory() {
        const current = this.layoutConfig;

        // First, check if there are enough items in the history queue
        if (!this._layoutHistory || this._layoutHistory.length <= 1) {
            return false;
        }

        // Check that the components are the same
        let itemListCurrent = new Array();
        let itemListPrev = new Array();
        const prev = this._layoutHistory[this._layoutHistory.length - 2];
        appendContentItems(itemListCurrent, current);
        itemListCurrent = itemListCurrent.sort((a, b) => (a.id >= b.id) ? 1 : -1);

        appendContentItems(itemListPrev, prev);
        itemListPrev = itemListPrev.sort((a, b) => (a.id >= b.id) ? 1 : -1);

        return (itemListCurrent.length === itemListPrev.length);
    }
}

function appendContentItems(itemList: Array<any>, container: any) {
    if (container && container.content && container.content.length) {
        for (let item of container.content) {
            if (item.type === "component") {
                itemList.push(item);
            }
            else {
                appendContentItems(itemList, item);
            }
        }
    }
}

function difference(object: any, base: any) {
    function changes(_object: any, _base: any) {
        return _.transform(_object, function (result: any, value: any, key: string) {
            if (!_.isEqual(value, _base[key])) {
                result[key] = (_.isObject(value) && _.isObject(_base[key])) ? changes(value, _base[key]) : value;
            }
        });
    }

    return changes(object, base);
}

// checks to see if change is purely based on a tab change or a component reaction
function isStaleChange(diff: any) {
    const keys = Object.keys(diff);
    if (diff.content && diff.content.length) {
        for (let obj of diff.content) {
            if (obj) {
                if (!isStaleChange(obj)) {
                    return false;
                }
            }
        }
    }
    const otherKeys = keys.filter(key => key !== "content" && key !== "activeItemIndex" && key !== "componentState");
    return otherKeys.length === 0;
}