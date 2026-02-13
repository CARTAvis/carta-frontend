import moment from "moment";

const {version} = require("../../../package.json");

const date = moment(process.env.BUILD_DATE || "").format("D MMM YYYY");
const year = moment(process.env.BUILD_DATE || "").year();

export const CARTA_INFO = {
    acronym: "CARTA",
    version,
    date,
    year,
    fullName: "Cube Analysis and Rendering Tool for Astronomy"
};
