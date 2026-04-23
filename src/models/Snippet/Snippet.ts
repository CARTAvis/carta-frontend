const {version} = require("../../../package.json");

export class Snippet {
    code: string;
    snippetVersion: number;
    frontendVersion: string;
    description?: string;
    tags?: string[];
    categories: string[];
    requires?: string[];

    public static readonly FrontendVersion = version;
    public static readonly SnippetVersion = 1;
}
