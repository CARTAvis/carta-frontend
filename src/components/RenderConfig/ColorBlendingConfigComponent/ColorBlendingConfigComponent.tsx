import {FormGroup, Text} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {ImageType} from "models";
import {AppStore} from "stores";

import "./ColorBlendingConfigComponent.scss";

export const ColorBlendingConfigComponent = observer(() => {
    const image = AppStore.Instance.activeImage;
    if (image?.type !== ImageType.COLOR_BLENDING) {
        return null;
    }

    const colorBlendingStore = image.store;

    return (
        <div className="color-blending-config">
            <FormGroup className="name-text" label="Layer 1" inline={true}>
                <Text ellipsize={true}>{colorBlendingStore.baseFrame.filename}</Text>
            </FormGroup>
            {colorBlendingStore.selectedFrames.map((f, i) => (
                <FormGroup className="name-text" label={`Layer ${i + 2}`} inline={true} key={i}>
                    <Text ellipsize={true}>{f.filename}</Text>
                </FormGroup>
            ))}
        </div>
    );
});
