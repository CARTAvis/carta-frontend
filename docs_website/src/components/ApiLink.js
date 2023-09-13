import React from "react";
import {useLocation} from "@docusaurus/router";
import Link from "@docusaurus/Link";

const versions = [];
//const versions = require("../../versions.json");

export default function ApiLink({children, path}) {
    const location = useLocation();
    const pathname = location.pathname;
    const versionSubPath = pathname.match(/\/carta-frontend\/(?:api|docs)\/([^\/]+)/)?.[1] ?? "";

    let version = "";
    if (versions?.slice(1)?.includes(versionSubPath) || versionSubPath === "next") {
        version = "/" + versionSubPath;
    }

    return <Link to={"/api" + version + path}>{children}</Link>;
}
