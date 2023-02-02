import moment from "moment";
import preval from "preval.macro";

const {version} = require("../../../package.json");

const build_date = preval`module.exports = new Date()`;
const date = moment(build_date).format("D MMM YYYY");

export const CARTA_INFO = {
    acronym: "CARTA",
    version,
    date,
    fullName: "Cube Analysis and Rendering Tool for Astronomy"
};
