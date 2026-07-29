import React from "react";
import Link from "@docusaurus/Link";
import {useLocation} from "@docusaurus/router";

const versions = require("../../versions.json");

function useVersion() {
    const location = useLocation();
    const pathname = location.pathname;
    const versionSegment = pathname.match(/\/carta-frontend\/(?:api|docs)\/([^/]+)/)?.[1] ?? "";

    let version = "";
    if (versions?.slice(1)?.includes(versionSegment) || versionSegment === "next") {
        version = "/" + versionSegment;
    }

    return version;
}

export function DocsIndexLink({children, path}) {
    return <Link to={"/docs" + useVersion() + "/category" + path}>{children}</Link>;
}

export function ApiLink({children, path}) {
    const version = useVersion();
    // If the path already starts with a version segment, use it as-is to avoid double-prefixing
    const hasVersionPrefix = path.startsWith(version + "/") && version !== "";
    return <Link to={"/api" + (hasVersionPrefix ? "" : version) + path}>{children}</Link>;
}
