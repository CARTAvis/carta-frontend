import {observable, action} from "mobx";

const KEY = "CARTA_saved_layout";

export class LayoutStore {

    @action saveLayout = (name: string) => {
        console.log(name);
    };

    @action getUserLayouts = () => {
        const layoutJson = localStorage.getItem(KEY);

        if (!layoutJson) {
            return null;
        }

        return null;
    };

    @action getPresetLayouts = () => {
        return null;
    };
}