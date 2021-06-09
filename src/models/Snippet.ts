const {version} = require('../../package.json');

export class Snippet {
    code: string;
    snippetVersion: number = 1;
    frontendVersion: string = version;
    description?: string;
    tags?: string[];
    categories?: string[];
    requires?: string[];
}