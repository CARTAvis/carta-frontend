import {NumberFormatType} from "enums";

export const NUMBER_FORMAT_LABEL = new Map<NumberFormatType, string>([
    [NumberFormatType.HMS, "H:M:S"],
    [NumberFormatType.DMS, "D:M:S"],
    [NumberFormatType.Degrees, "Degrees"]
]);
