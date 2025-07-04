---
sidebar_position: 5
---

# Release guidelines

In this document, 123 is a placeholder for the current release number, and 124 for the following release number.

## Beta releases

### Beta release

1. `dev` branch: update `CHANGELOG.md`. Change the `Unreleased` heading to `123.0.0-beta.0`.
2. `dev` branch: update the user manual URL if necessary.
3. Create a `release/123.0` branch using the `dev` branch.
4. `release/123.0` branch: update the `package.json` version string to `123.0.0-beta.0`. Run `npm install` to update `package-lock.json`.
5. Create a `v123.0.0-beta.0` tag using the release branch.
6. Test the release branch. Make any required fixes in the `dev` branch, and merge them into the release branch. Ideally, bump the version and create a new tag every time changes are merged. If you don't want to bump the version, remember to destroy and recreate the latest tag.
7. Create packages from the release branch.

### After beta release

1. `dev` branch: update `CHANGELOG.md`. Create a new `Unreleased` section.
2. `dev` branch: update the documentation website ([guidelines](./documentation-guidelines/#Versioning)). Create a new version `123.0.0-beta.0`.

### Additional beta release

This process should be followed if changes have to be made after the beta packages have already been published (or even provided to a limited number of users). If there are significant changes in `dev` that should _not_ be included in the beta release, follow the point release procedure instead (but adjust the version strings as required).

1. Make the required fixes in `dev`.
2. `dev` branch: update `CHANGELOG.md`. Change the `Unreleased` heading to `123.0.0-beta.1`.
3. `dev` branch: update the user manual URL if necessary.
4. Merge the `dev` branch into the `release/123.0` branch.
5. `release/123.0` branch: update the `package.json` version string to `123.0.0-beta.1`. Run `npm install` to update `package-lock.json`.
6. Create a `v123.0.0-beta.1` tag using the release branch.
7. Test the release branch. Make any required fixes in the `dev` branch, and merge them into the release branch. Ideally, bump the version and create a new tag every time changes are merged. If you don't want to bump the version, remember to destroy and recreate the latest tag.
8. Create packages from the release branch.

## Stable releases

### Final release

1. `dev` branch: update `CHANGELOG.md`. Change the `Unreleased` heading to `123.0.0`.
2. `dev` branch: update the user manual URL if necessary.
3. Merge the `dev` branch into the `release/123.0` branch.
4. `release/123.0` branch: update the `package.json` version string to `123.0.0-rc.0`. Run `npm install` to update `package-lock.json`.
5. Create a `v123.0.0-rc.0` tag using the release branch.
6. Test the release branch. Make any required fixes in the `dev` branch, and merge them into the release branch. Ideally, bump the version and create a new tag every time changes are merged. If you don't want to bump the version, remember to destroy and recreate the latest tag.
7. `release/123.0` branch: update the `package.json` version string to `123.0.0`. Run `npm install` to update `package-lock.json`.
8. Create a `v123.0.0` tag using the release branch.
9. Create packages from the release branch.

### After final release

1. `dev` branch: update the `package.json` version string to `124.0.0-dev`. Run `npm install` to update `package-lock.json`.
2. `dev` branch: update `CHANGELOG.md`. Create a new `Unreleased` section.
3. `dev` branch: update the documentation website ([guidelines](./documentation-guidelines/#Versioning)). Create a new version `123.0.0`.

### Point release

This process should be followed if important bug fixes have to be released after the final release packages have already been published (or even provided to a limited number of users). If there are no changes in `dev` that should not be included in the point release, follow the additional beta release procedure instead (but adjust the version strings as required).

1. Make the required fixes in `dev`. Cherry-pick them into the release branch.
2. `dev` branch: update `CHANGELOG.md`. Move the cherry-picked changes from the `Unreleased` section to a new `123.0.1` section _under_ `Unreleased`.
3. `release/123.0` branch: update `CHANGELOG.md`. Copy only the `123.0.1` section from the changelog in the `dev` branch.
4. `release/123.0` branch: update the `package.json` version string to `123.0.1`. Run `npm install` to update `package-lock.json`.
5. Create a `v123.0.1` tag using the release branch.
6. Test the release branch. If an issue affects both `dev` and the release branch, fix it in `dev` and cherry-pick the changes into the release branch. If an issue is caused by changes in `dev` which are not included in the point release, make the minimal required changes in the release branch. Ideally, bump the version and create a new tag every time changes are made. If you don't want to bump the version, remember to destroy and recreate the latest tag.
7. Create packages from the release branch.

### After point release

-   `dev` branch: update the documentation website ([guidelines](./documentation-guidelines/#Versioning)). Replace version `123.0.0` with `123.0.1`.
