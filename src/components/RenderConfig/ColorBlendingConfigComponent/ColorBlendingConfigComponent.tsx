import {FormGroup, HTMLSelect, Text} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {ImageType} from "models";
import {AppStore, type FrameStore} from "stores";

import "./ColorBlendingConfigComponent.scss";

export const ColorBlendingConfigComponent = observer(() => {
    const image = AppStore.Instance.activeImage;
    if (image?.type !== ImageType.COLOR_BLENDING) {
        return null;
    }

    const colorBlendingStore = image.store;

    const getFrameOptions = (frame: FrameStore): {value: number; label: string}[] => {
        const otherSelectedFrames = colorBlendingStore.selectedFrames.filter(f => f !== frame);
        const matchedFrames = colorBlendingStore.baseFrame?.secondarySpatialImages ?? [];
        return matchedFrames.filter(f => !otherSelectedFrames.includes(f)).map(f => ({value: f.id, label: f.filename}));
    };

    const setSelectedFrame = (index: number, fileId: number) => {
        colorBlendingStore.setSelectedFrame(index, AppStore.Instance.getFrame(fileId));
    };

    return (
        <div className="color-blending-config">
            <FormGroup className="name-text" label="Layer 1" inline={true}>
                <Text ellipsize={true}>{colorBlendingStore.baseFrame.filename}</Text>
            </FormGroup>
            {colorBlendingStore.selectedFrames.map((f, i) => (
                <FormGroup className="name-text" label={`Layer ${i + 2}`} inline={true} key={i}>
                    <HTMLSelect value={f.id} options={getFrameOptions(f)} onChange={ev => setSelectedFrame(i, parseInt(ev.target.value))} />
                </FormGroup>
            ))}
        </div>
    );
});
