import moment from "moment";
import preval from "preval.macro";

const {version} = require("../../../package.json");

const isDev = version.includes("-dev") || version.includes("-beta");
const majorMinorVersionMatch = `${version}`.match(/^(\d+)\.(\d+)/);
const majorMinorVersion = majorMinorVersionMatch ? `${majorMinorVersionMatch[1]}.${majorMinorVersionMatch[2]}` : "dev";
const docsVersion = isDev ? "dev" : majorMinorVersion;

const build_date = preval`module.exports = new Date()`;
const date = moment(build_date).format("D MMM YYYY");
const year = moment(build_date).year();

export const CARTA_INFO = {
    acronym: "CARTA",
    version,
    docsVersion,
    date,
    year,
    fullName: "Cube Analysis and Rendering Tool for Astronomy"
};
