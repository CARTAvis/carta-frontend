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

The "API" subpages are generated from the `tsdoc` documentation in the codebase. Catalogs are created based on the `index.ts` files, and elements need to be exported in the respective `index.ts` file to appear on the catalog subpages. Private and projected elements are not displayed.

For the `tsdoc` documentation format, please refer to the [tsdoc documentation](https://tsdoc.org). ESLint is applied to check for the required format. To run the lint checks (from the repository root):

```
npm run check-eslint
```

Please note that the development server does not automatically re-parse `tsdoc`. Therefore, if you modify `tsdoc` in the codebase, you will need to rebuild it to display the changes.
