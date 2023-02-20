import {CARTA} from "carta-protobuf";
import * as _ from "lodash";

// order matters, since ... and .. both having .. (same for < and <=, > and >=)
export enum ComparisonOperator {
    Equal = "==",
    NotEqual = "!=",
    LessorOrEqual = "<=",
    Lesser = "<",
    GreaterOrEqual = ">=",
    Greater = ">",
    RangeClosed = "...",
    RangeOpen = ".."
}

export function parseBoolean(value: string, defaultValue: boolean): boolean {
    if (value === "true") {
        return true;
    } else if (value === "false") {
        return false;
    } else {
        return defaultValue;
    }
}

export function parseNumber(val: number, initVal: number): number {
    if (isFinite(val)) {
        return val;
    } else {
        return initVal;
    }
}

export function trimFitsComment(val: string): string {
    if (!val) {
        return "";
    }

    // replace standard Fits header comments
    return val.replace(/\s\/\s?.*$/, "");
}

export function mapToObject<K, T>(map: Map<K, T>) {
    const obj: {[k: string]: T} = {};
    map.forEach((value, key) => {
        obj[key.toString()] = value;
    });
    return obj;
}

export function findDeep(obj: any, pred: (obj: any) => boolean) {
    if (pred(obj)) {
        return [obj];
    }
    return _.flatten(
        _.map(obj, child => {
            return typeof child === "object" ? findDeep(child, pred) : [];
        })
    );
}

// parsing filter string for TableComponent filter function
function getNumberFromFilterString(filterString: string): number {
    const n = filterString.replace(/[^0-9.+-.]+/g, "");
    if (n !== "") {
        return Number(n);
    }
    return undefined;
}

export function getComparisonOperatorAndValue(filterString: string): {operator: CARTA.ComparisonOperator; values: number[]} {
    const filter = filterString.replace(/\s/g, "");
    let result = {operator: -1, values: []};
    // order matters, since ... and .. both include .. (same for < and <=, > and >=)
    for (const key of Object.keys(ComparisonOperator)) {
        const operator = ComparisonOperator[key];
        const found = filter.includes(operator);
        if (found) {
            if (operator === ComparisonOperator.Equal) {
                const equalTo = getNumberFromFilterString(filter);
                if (equalTo !== undefined) {
                    result.operator = CARTA.ComparisonOperator.Equal;
                    result.values.push(equalTo);
                }
                return result;
            } else if (operator === ComparisonOperator.NotEqual) {
                const notEqualTo = getNumberFromFilterString(filter);
                if (notEqualTo !== undefined) {
                    result.operator = CARTA.ComparisonOperator.NotEqual;
                    result.values.push(notEqualTo);
                }
                return result;
            } else if (operator === ComparisonOperator.Lesser) {
                const lessThan = getNumberFromFilterString(filter);
                if (lessThan !== undefined) {
                    result.operator = CARTA.ComparisonOperator.Lesser;
                    result.values.push(lessThan);
                }
                return result;
            } else if (operator === ComparisonOperator.LessorOrEqual) {
                const lessThanOrEqualTo = getNumberFromFilterString(filter);
                if (lessThanOrEqualTo !== undefined) {
                    result.values.push(lessThanOrEqualTo);
                    result.operator = CARTA.ComparisonOperator.LessorOrEqual;
                }
                return result;
            } else if (operator === ComparisonOperator.Greater) {
                const greaterThan = getNumberFromFilterString(filter);
                if (greaterThan !== undefined) {
                    result.operator = CARTA.ComparisonOperator.Greater;
                    result.values.push(greaterThan);
                }
                return result;
            } else if (operator === ComparisonOperator.GreaterOrEqual) {
                const greaterThanOrEqualTo = getNumberFromFilterString(filter);
                if (greaterThanOrEqualTo !== undefined) {
                    result.values.push(greaterThanOrEqualTo);
                    result.operator = CARTA.ComparisonOperator.GreaterOrEqual;
                }
                return result;
            } else if (operator === ComparisonOperator.RangeOpen) {
                const fromTo = filter.split(ComparisonOperator.RangeOpen, 2);
                if (fromTo[0] !== "" && fromTo[1] !== "") {
                    result.values.push(Number(fromTo[0]));
                    result.values.push(Number(fromTo[1]));
                    result.operator = CARTA.ComparisonOperator.RangeOpen;
                }
                return result;
            } else if (operator === ComparisonOperator.RangeClosed) {
                const betweenAnd = filter.split(ComparisonOperator.RangeClosed, 2);
                if (betweenAnd[0] !== "" && betweenAnd[1] !== "") {
                    result.values.push(Number(betweenAnd[0]));
                    result.values.push(Number(betweenAnd[1]));
                    result.operator = CARTA.ComparisonOperator.RangeClosed;
                }
                return result;
            }
        }
    }
    return result;
}
