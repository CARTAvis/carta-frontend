**Description**

This PR is for the release version bump, the final step before tagging a beta release or creating a stable release branch.

**Checklist**

- [ ] `package.json` version string updated
- [ ] `package-lock.json` version string updated (by running `npm install`)
- [ ] changelog version string updated
- [ ] user manual URL in the about dialog updated (for stable releases)

**Note**

The documentation website requires an update (following the [guidelines](https://cartavis.org/carta-frontend/docs/contributing/documentation-guidelines#versioning)) after the beta release is tagged or the stable release branch is created.
