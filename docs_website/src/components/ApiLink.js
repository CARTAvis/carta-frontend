import React from "react";
import {useLocation} from "@docusaurus/router";
import Link from "@docusaurus/Link";

const versions = require("../../versions.json");

export default function ApiLink({children, path}) {
    const location = useLocation();
    const pathname = location.pathname;

    let version = pathname.match(/\/carta-frontend\/(?:api|docs)\/([^\/]+)/)?.[1] ?? "";
    if (!versions?.slice(1)?.includes(version) && version !== "next") {
        version = "";
    }
    if (version) {
        version = "/" + version;
    }

    return <Link to={"/api" + version + path}>{children}</Link>;
}
