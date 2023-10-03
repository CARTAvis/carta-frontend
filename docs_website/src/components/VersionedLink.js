import React from "react";
import {useLocation} from "@docusaurus/router";
import Link from "@docusaurus/Link";

const versions = require("../../versions.json");

function getVersion() {
    const location = useLocation();
    const pathname = location.pathname;
    const versionSubPath = pathname.match(/\/carta-frontend\/(?:api|docs)\/([^\/]+)/)?.[1] ?? "";

    let version = "";
    if (versions?.slice(1)?.includes(versionSubPath) || versionSubPath === "next") {
        version = "/" + versionSubPath;
    }

    return version;
}

export function DocsIndexLink({children, path}) {
    return <Link to={"/docs" + getVersion() + "/category" + path}>{children}</Link>;
}

export function ApiLink({children, path}) {
    return <Link to={"/api" + getVersion() + path}>{children}</Link>;
}
