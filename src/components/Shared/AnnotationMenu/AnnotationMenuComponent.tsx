import * as React from "react";
import {IconName, MenuItem} from "@blueprintjs/core";

import {ToolbarMenuComponent} from "components/Menu/ToolbarMenu/ToolbarMenuComponent";
import {CustomIcon, CustomIconName} from "icons/CustomIcons";
import {RegionStore} from "stores/Frame";

export const AnnotationMenuComponent = () => {
    return (
        <React.Fragment>
            {Array.from(RegionStore.AVAILABLE_ANNOTATION_TYPES).map(([type, text], index) => {
                const annotationIconString: IconName | CustomIconName = RegionStore.RegionIconString(type);
                const annotationIcon = RegionStore.IsRegionCustomIcon(type) ? <CustomIcon icon={annotationIconString as CustomIconName} /> : (annotationIconString as IconName);
                return <MenuItem icon={annotationIcon} text={text} onClick={() => ToolbarMenuComponent.handleRegionTypeClicked(type)} key={index} />;
            })}
        </React.Fragment>
    );
};
