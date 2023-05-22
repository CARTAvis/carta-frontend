import * as React from "react";
import {IconName, MenuItem} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {observer} from "mobx-react";

import {CustomIcon, CustomIconName} from "icons/CustomIcons";
import {FrameStore, RegionMode, RegionStore} from "stores/Frame";

export class AnnotationMenuComponentProps {
    frame: FrameStore;
}

@observer
export class AnnotationMenuComponent extends React.Component<AnnotationMenuComponentProps> {

    handleRegionTypeClicked = (type: CARTA.RegionType) => {
        this.props.frame.regionSet.setNewRegionType(type);
        this.props.frame.regionSet.setMode(RegionMode.CREATING);
    };

    render() {        
        return (
            <React.Fragment>
               {Array.from(RegionStore.AVAILABLE_ANNOTATION_TYPES).map(([type, text], index) => {
                    const annotationIconString: IconName | CustomIconName = RegionStore.RegionIconString(type);
                    const annotationIcon = RegionStore.IsRegionCustomIcon(type) ? <CustomIcon icon={annotationIconString as CustomIconName} /> : (annotationIconString as IconName);
                    return <MenuItem icon={annotationIcon} text={text} onClick={() => this.handleRegionTypeClicked(type)} key={index} />;
                })}
            </React.Fragment>
        );
    }
}