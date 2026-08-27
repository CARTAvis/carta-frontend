import {type CARTA} from "carta-protobuf";
import * as _ from "lodash";
import {toJS} from "mobx";

import {isScriptingMap, parseReturnPath, type ReturnPath} from "scripting/returnPath";
import {AppStore} from "stores";

export class ExecutionEntry {
    target: string | null | undefined;
    action: string | null | undefined;
    parameters: any[];
    isValid: boolean;
    isAsync: boolean | null | undefined;
    hasResolvedUndefinedMacro = false;

    public static fromString(entryString: string): ExecutionEntry {
        const executionEntry = new ExecutionEntry();
        entryString = entryString.trim();

        const entryRegex = /^(\+?)((?:[\w[\]]+\.)*)(\w+)\(([^)]*)\);?$/gm;
        const matches = entryRegex.exec(entryString);
        // Four matching groups, first entry is the full match
        if (matches && matches.length === 5 && matches[3].length) {
            executionEntry.isAsync = matches[1].length > 0;
            if (matches[2].length) {
                executionEntry.target = matches[2].substring(0, matches[2].length - 1);
            }
            executionEntry.action = matches[3];
            executionEntry.isValid = executionEntry.parseParameters(matches[4], true);
        } else {
            executionEntry.isValid = false;
        }
        return executionEntry;
    }

    public static fromScriptingRequest(requestMessage: CARTA.ScriptingRequest.$Properties): ExecutionEntry {
        const executionEntry = new ExecutionEntry();
        executionEntry.isAsync = requestMessage.async;
        executionEntry.target = requestMessage.target;
        executionEntry.action = requestMessage.action;
        executionEntry.isValid = executionEntry.parseParameters(requestMessage.parameters, false);
        return executionEntry;
    }

    private parseParameters(parameterString: string | null | undefined, shouldPad: boolean) {
        if (!parameterString) {
            this.parameters = [];
            return true;
        }
        try {
            let substitutedParameterString = parameterString.replace(/\$((?:[\w[\]]+\.)*)([\w[\]]+)/gm, (_match, target, variable) => {
                return `{"macroTarget": "${target.slice(0, -1)}", "macroVariable": "${variable}"}`;
            });
            if (shouldPad) {
                substitutedParameterString = `[${substitutedParameterString}]`;
            }
            this.parameters = JSON.parse(substitutedParameterString);
        } catch (e) {
            console.error(e);
            return false;
        }
        return true;
    }

    async execute() {
        const {hasTarget, value: targetObject} = ExecutionEntry.resolveTargetObject(AppStore.Instance, this.target);
        if (!hasTarget || targetObject == null) {
            throw new Error(`Missing target object: ${this.target}`);
        }
        const currentParameters = this.parameters.map(this.mapMacro);
        let actionFunction = targetObject[this.action ?? NaN];
        if (!actionFunction || typeof actionFunction !== "function") {
            throw new Error(`Missing action function: ${this.action}`);
        }
        actionFunction = actionFunction.bind(targetObject);
        let response;
        if (this.isAsync) {
            response = actionFunction(...currentParameters);
        } else {
            response = await actionFunction(...currentParameters);
        }
        return response;
    }

    private static resolveTargetObject(baseObject: any, targetString: string | null | undefined): {hasTarget: boolean; value: any} {
        if (!targetString) {
            return {hasTarget: true, value: baseObject};
        }

        let target = baseObject;
        const targetNameArray = targetString.split(".");

        for (const targetEntry of targetNameArray) {
            const arrayRegex = /(\w+)(?:\[(\d+)])?/gm;
            const matches = arrayRegex.exec(targetEntry);
            // Check if there's an array index in this parameter
            if (matches && matches.length === 3 && matches[2] !== undefined) {
                if (!_.hasIn(target, matches[1])) {
                    return {hasTarget: false, value: undefined};
                }
                target = target[matches[1]];
                if (target == null) {
                    return {hasTarget: false, value: undefined};
                }
                if (target instanceof Map) {
                    const key = JSON.parse(matches[2]);
                    if (!target.has(key)) {
                        return {hasTarget: false, value: undefined};
                    }
                    target = target.get(key);
                } else if (Array.isArray(target)) {
                    if (!(Number(matches[2]) in target)) {
                        return {hasTarget: false, value: undefined};
                    }
                    target = target[matches[2]];
                } else {
                    return {hasTarget: false, value: undefined};
                }
            } else {
                if (!_.hasIn(target, targetEntry)) {
                    return {hasTarget: false, value: undefined};
                }
                target = target[targetEntry];
            }
        }
        return {hasTarget: true, value: target};
    }

    private mapMacro = (parameter: any) => {
        if (Array.isArray(parameter)) {
            return parameter.map(this.mapMacro);
        }
        if (typeof parameter === "object" && parameter?.macroVariable) {
            if (parameter.macroVariable === "undefined") {
                return undefined;
            }
            const targetString = parameter?.macroTarget ? `${parameter.macroTarget}.${parameter.macroVariable}` : parameter.macroVariable;
            const {hasTarget, value} = ExecutionEntry.resolveTargetObject(AppStore.Instance, targetString);
            if (!hasTarget) {
                throw new Error(`Missing macro target: ${targetString}`);
            }
            if (value === undefined) {
                this.hasResolvedUndefinedMacro = true;
            }
            return value;
        }
        return parameter;
    };
}

export class ScriptingService {
    private static staticInstance: ScriptingService;

    public static get Instance() {
        if (!ScriptingService.staticInstance) {
            ScriptingService.staticInstance = new ScriptingService();
        }
        return ScriptingService.staticInstance;
    }

    public static delay(timeout: number) {
        return new Promise<void>(resolve => {
            setTimeout(resolve, timeout);
        });
    }

    private static selectReturnPath(value: any, returnPath: Exclude<ReturnPath, string>): Record<string, any> {
        const paths = Array.isArray(returnPath) ? returnPath.map(path => [path, path]) : Object.entries(returnPath);
        return Object.fromEntries(paths.map(([key, path]) => [key, _.get(value, path)]));
    }

    private static applyReturnPath(response: any, returnPath: string): any {
        const parsedReturnPath = parseReturnPath(returnPath);

        if (typeof parsedReturnPath !== "string") {
            if (Array.isArray(response)) {
                return response.map(value => ScriptingService.selectReturnPath(value, parsedReturnPath));
            }

            if (response instanceof Map || isScriptingMap(response)) {
                const entries = response instanceof Map ? response.entries() : Object.entries(response);
                return Object.fromEntries(Array.from(entries, ([key, value]) => [key, ScriptingService.selectReturnPath(value, parsedReturnPath)]));
            }

            if (typeof response === "object") {
                return ScriptingService.selectReturnPath(response, parsedReturnPath);
            }

            return response;
        }

        if (Array.isArray(response)) {
            return response.map(value => _.get(value, parsedReturnPath));
        }

        if (response instanceof Map || isScriptingMap(response)) {
            const entries = response instanceof Map ? response.entries() : Object.entries(response);
            return Object.fromEntries(Array.from(entries, ([key, value]) => [key, _.get(value, parsedReturnPath)]));
        }

        if (typeof response === "object") {
            const hasResponsePath = _.hasIn(response, parsedReturnPath);
            const selectedResponse = _.get(response, parsedReturnPath);
            if (!hasResponsePath) {
                throw new Error(`Missing response path: ${parsedReturnPath}`);
            }
            // JSON cannot represent undefined. Preserve the distinction between a
            // missing path and an existing path without a value by returning null.
            return selectedResponse === undefined ? null : selectedResponse;
        }

        return response;
    }

    handleScriptingRequest = async (requestMessage: CARTA.ScriptingRequest.$Properties): Promise<CARTA.ScriptingResponse.$Properties> => {
        const entry = ExecutionEntry.fromScriptingRequest(requestMessage);
        if (!entry.isValid) {
            return {
                scriptingRequestId: requestMessage.scriptingRequestId,
                success: false,
                message: "Failed to parse scripting request"
            };
        }

        try {
            let response: any;
            if (entry.isAsync) {
                // If entry is asynchronous, don't wait for it to complete before moving to the next entry
                response = entry.execute();
            } else {
                response = await entry.execute();
            }

            // Adjust the response to just the specified path if it is non-empty
            if (requestMessage.returnPath) {
                if (response === null || typeof response !== "object") {
                    throw new Error(`Cannot read response path from a non-object response: ${requestMessage.returnPath}`);
                }
                response = ScriptingService.applyReturnPath(response, requestMessage.returnPath);
            }

            if (response === undefined && entry.hasResolvedUndefinedMacro) {
                response = null;
            }

            return {
                scriptingRequestId: requestMessage.scriptingRequestId,
                success: true,
                response: JSON.stringify(toJS(response))
            };
        } catch (err) {
            console.error(err);
            return {
                scriptingRequestId: requestMessage.scriptingRequestId,
                success: false,
                message: err instanceof Error ? err.message : String(err)
            };
        }
    };

    executeEntries = async (executionEntries: ExecutionEntry[]) => {
        if (!executionEntries || !executionEntries.length) {
            return;
        }

        for (const entry of executionEntries) {
            try {
                if (entry.isAsync) {
                    // If entry is asynchronous, don't wait for it to complete before moving to the next entry
                    entry.execute();
                } else {
                    await entry.execute();
                    // TODO: more tests to see if this is really necessary
                    await ScriptingService.delay(10);
                }
            } catch (err) {
                console.error(err);
            }
        }
    };
}
