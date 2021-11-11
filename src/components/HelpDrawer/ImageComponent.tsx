import * as React from "react";
import {AppStore} from "stores";

export class ImageComponent extends React.Component<{
    light: string;
    dark: string;
    width: string;
}> {
    public render() {
        const appStore = AppStore.Instance;
        return <img src={appStore.darkTheme ? this.props.dark : this.props.light} style={{width: this.props.width, height: "auto"}} />;
    }
}
