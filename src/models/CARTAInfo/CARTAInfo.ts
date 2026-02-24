import moment from "moment";

const {version} = require("../../../package.json");

const isDev = version.includes("-dev") || version.includes("-beta");
const majorMinorVersionMatch = `${version}`.match(/^(\d+)\.(\d+)/);
const majorMinorVersion = majorMinorVersionMatch ? `${majorMinorVersionMatch[1]}.${majorMinorVersionMatch[2]}` : "dev";
const docsVersion = isDev ? "dev" : majorMinorVersion;

const date = moment(process.env.BUILD_DATE || "").format("D MMM YYYY");
const year = moment(process.env.BUILD_DATE || "").year();

export const CARTA_INFO = {
    acronym: "CARTA",
    version,
    docsVersion,
    date,
    year,
    fullName: "Cube Analysis and Rendering Tool for Astronomy"
};
