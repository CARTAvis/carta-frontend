---
sidebar_position: 4
---

# Documentation guidelines

Guidelines for building and writing this website.

## Building documentaiton

The website is hosted on Github Pages, and whenever the `dev` branch is updated, the website is automatically updated using Github Actions.

To build and test the website locally, navigate to the `docs/` directory and install package dependencies:

```
cd docs
npm install
```

and run the development server:

```
npm start
```

If you make changes to the files in the `docs/docs` and `docs/api` folders, the site will automatically reload and display the changes.

To create a local production build:

```
npm run build
```

To test the local production build:

```
npm run serve
```

## Writing documentation pages

The "Docs" pages and the "API/Overview" page are generated from markdown files in the `docs/docs` and `docs/api` directories. Simply edit these directories to modify the content or add new pages.

To check the format of the changes, run (from the `docs/` folder):

```
npm run checkformat
```

To automatically fix the format:

```
npm run reformat
```

This maintains consistent markdown styling, including indentation, maximum line length, and list numbering. Please refer to the [Prettier documentation](https://prettier.io/blog/2017/11/07/1.8.0.html#markdown-support) for more information.

## Writing API documentation

The subpages under the "API" section are generated from the `tsdoc` documentation in the codebase. Please refer to [tsdoc documentation](https://tsdoc.org) for the required format. The `docusaurus-plugin-typedoc-api` plugin scans the `index.ts` files, so new elements need to be exported in these files to be displayed on the "API" subpages.

ESLint is applied to check the required format of `tsdoc` documentation. To run the lint checks (from the repository root):

```
npm run check-eslint
```

Note that the development server does not automatically re-parse `tsdoc`. Therefore, if you make changes to `tsdoc` in the codebase, you will need to rebuild it to display the changes.
