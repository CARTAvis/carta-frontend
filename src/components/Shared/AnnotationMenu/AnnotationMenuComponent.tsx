import * as React from "react";
import {IconName, MenuItem} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {observer} from "mobx-react";

import {CustomIcon, CustomIconName} from "icons/CustomIcons";
import {AppStore} from "stores";
import {RegionMode, RegionStore} from "stores/Frame";

@observer
export class AnnotationMenuComponent extends React.Component {
    handleRegionTypeClicked = (type: CARTA.RegionType) => {
        const appStore = AppStore.Instance;
        appStore.activeFrame.regionSet.setNewRegionType(type);
        appStore.activeFrame.regionSet.setMode(RegionMode.CREATING);
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
