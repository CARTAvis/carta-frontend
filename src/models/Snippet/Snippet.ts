const {version} = require("../../../package.json");

export class Snippet {
    code: string;
    snippetVersion: number;
    frontendVersion: string;
    description?: string;
    tags?: string[];
    categories: string[];
    requires?: string[];

    static readonly FRONTEND_VERSION = version;
    static readonly SNIPPET_VERSION = 1;
}
