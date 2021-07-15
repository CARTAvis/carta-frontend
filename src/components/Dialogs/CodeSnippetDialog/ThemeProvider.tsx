import * as React from "react";

const LightTheme = React.lazy(() => import("./LightCodeTheme"));
const DarkTheme = React.lazy(() => import("./DarkCodeTheme"));

export const ThemeProvider = (props: {darkTheme: boolean; children?}) => {
    return (
        <React.Fragment>
            <React.Suspense fallback={<React.Fragment></React.Fragment>}>
                {!props.darkTheme && <LightTheme />}
                {props.darkTheme && <DarkTheme />}
            </React.Suspense>
            {props.children}
        </React.Fragment>
    );
};
