---
sidebar_position: 4
---

# Documentation guidelines

Guidelines for building and writing this website.

## Building documentaiton

The website is hosted on Github Pages, and whenever the `dev` branch is updated, the website is automatically updated using Github Actions.

To build and test the website locally, navigate to the `docs_website/` directory and install package dependencies:

```
cd docs_website
npm install
```

and run the development server:

```
npm start
```

If you make changes to the files in the `docs/` and `api/` folders, the site will automatically reload and display the changes.

To create a local production build:

```
npm run build
```

To test the local production build:

```
npm run serve
```

Please note that the search feature is only available in production builds.

## Writing documentation pages

The "Docs" pages and the "API/Overview" page are generated from markdown files in the `docs/` and `api/` directories. Simply edit these directories to modify the content or add new pages.

For links to the "Docs" index pages and "API" subpages, it is required to use the `DocsIndexLink` and `ApiLink` MDX components to ensure the corresponding version is linked. If the file contains MDX components, it is recommended to use the `.mdx` extension.

:::note

There is a [known issue](https://docusaurus.io/docs/markdown-features/react#markdown-and-jsx-interoperability) when the MDX component is placed at the start of the paragraph, the Markdown syntax parsing fails. As a workaround, zero-width spaces `&#8203;` are placed at the start of the paragraph in such cases.

:::

### Formatting

To check the format of the changes, run (from the `docs_website/` folder):

```
npm run checkformat
```

To automatically fix the format:

```
npm run reformat
```

This maintains consistent markdown styling, including indentation, maximum line length, and list numbering. Please refer to the [Prettier documentation](https://prettier.io/blog/2017/11/07/1.8.0.html#markdown-support) for more information.

## Writing API documentation

The "API" subpages are generated from TSDoc documentation in the codebase. Catalogs are created based on the `index.ts` files, and elements need to be exported in the respective `index.ts` file to appear on the catalog subpages. Private and projected elements are not displayed.

Please note that the development server does not automatically re-parse TSDoc. Therefore, if you modify TSDoc in the codebase, you will need to rebuild it to display the changes.

### Formatting

For TSDoc format, please refer to the [TSDoc documentation](https://tsdoc.org). ESLint is applied to check for the required format. To run the lint checks (from the repository root):

```
npm run check-eslint
```

## Versioning

To tag a new version, run (from the `docs_website/` folder):

```
npm run docusaurus docs:version 1.2.3
npm run docusaurus api:version 1.2.3
```

This will append the new version to `versions.json` and create files in the `versioned_docs/` and `versioned_sidebars/` folders. To modify the content or add new pages for a specific version, edit the files in these folders.
