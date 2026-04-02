import moment from "moment";

const {version} = require("../../../package.json");

const isDev = version.includes("-dev") || version.includes("-beta");
const majorMinorVersionMatch = `${version}`.match(/^(\d+)\.(\d+)/);
const MAJOR_MINOR_VERSION = majorMinorVersionMatch ? `${majorMinorVersionMatch[1]}.${majorMinorVersionMatch[2]}` : "dev";
const DOCS_VERSION = isDev ? "dev" : MAJOR_MINOR_VERSION;

const DATE = moment(process.env.BUILD_DATE || "").format("D MMM YYYY");
const YEAR = moment(process.env.BUILD_DATE || "").year();

export const CARTA_INFO = {
    acronym: "CARTA",
    version,
    docsVersion: DOCS_VERSION,
    date: DATE,
    year: YEAR,
    fullName: "Cube Analysis and Rendering Tool for Astronomy"
};
