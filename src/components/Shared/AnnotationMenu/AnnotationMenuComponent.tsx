import * as React from "react";
import {IconName} from "@blueprintjs/core";
import {MenuItem2} from "@blueprintjs/popover2";
import {CARTA} from "carta-protobuf";

import {CustomIcon, CustomIconName} from "icons/CustomIcons";
import {RegionStore} from "stores/Frame";

interface AnnotationMenuComponentProps {
    handleRegionTypeClicked: (type: CARTA.RegionType) => void;
}

export const AnnotationMenuComponent = ({handleRegionTypeClicked}: AnnotationMenuComponentProps) => {
    return (
        <>
            {Array.from(RegionStore.AVAILABLE_ANNOTATION_TYPES).map(([type, text], index) => {
                const annotationIconString: IconName | CustomIconName = RegionStore.RegionIconString(type);
                const annotationIcon = RegionStore.IsRegionCustomIcon(type) ? <CustomIcon icon={annotationIconString as CustomIconName} /> : (annotationIconString as IconName);
                return <MenuItem2 icon={annotationIcon} text={text} onClick={() => handleRegionTypeClicked(type)} key={index} />;
            })}
        </>
    );
};
