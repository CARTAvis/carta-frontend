import React from "react";
import Link from "@docusaurus/Link";
import {useLocation} from "@docusaurus/router";

const versions = require("../../versions.json");

function useVersion() {
    const location = useLocation();
    const pathname = location.pathname;
    const versionSubPath = pathname.match(/\/carta-frontend\/(?:api|docs)\/([^]+)/)?.[1] ?? "";

    let version = "";
    if (versions?.slice(1)?.includes(versionSubPath) || versionSubPath === "next") {
        version = "/" + versionSubPath;
    }

    return version;
}

export function DocsIndexLink({children, path}) {
    return <Link to={"/docs" + useVersion() + "/category" + path}>{children}</Link>;
}

export function ApiLink({children, path}) {
    return <Link to={"/api" + useVersion() + path}>{children}</Link>;
}
