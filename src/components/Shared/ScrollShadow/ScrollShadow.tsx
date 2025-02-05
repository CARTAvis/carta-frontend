import React from "react";

import "./ScrollShadow.scss";

export const ScrollShadow = ({children}: {children: React.ReactNode}) => {
    return (
        <div className="scroll-shadow">
            <div className="scroll-shadow-cover">{children}</div>
        </div>
    );
};
