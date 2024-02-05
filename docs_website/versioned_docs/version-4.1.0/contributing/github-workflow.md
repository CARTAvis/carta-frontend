---
sidebar_position: 2
---

# Github workflow

The workflow for contributing to the codebase.

## Creating new issues

When creating new issues, please refer to [this page](https://github.com/CARTAvis/carta-frontend/labels) for the available labels that can be added.

If the issue is related to bug fixing, please use the [bug report template](https://github.com/CARTAvis/carta-frontend/blob/dev/.github/ISSUE_TEMPLATE/bug_report.md). Please make sure to fill in the template with all the necessary information, including the description, reproduction steps, and platform information. Providing reproduction steps is particularly helpful for resloving issues. Additionally, including testing images can be helpful for reproducing the issue.

## Contributing to the codebase

### Cloning and building the codebase

To clone the codebase to your computer:

```
git clone git@github.com:CARTAvis/carta-frontend.git
```

For detailed instructions on building the codebase from source, please refer to the [README file](https://github.com/CARTAvis/carta-frontend/blob/dev/README.md#development).

### Creating a branch

Before making any changes to the codebase, create and check out to a new branch. It's recommended to use the following format for branch names:

```
git checkout -b "[author]/[issue id]_[description_with_underscores]"
```

If the issue doesn't exist yet, please create a new issue. When you start working on the issue, update the ZenHub status of the issue to "In Progress".

### Pushing changes

To stage and commit your changes:

```
git add .
git commit -m "a short description of the change"
```

To push the branch to the remote repository:

```
git push
```

### Making a pull request

#### Pull request template

When making a pull request from you branch, please use the [pull request template](https://github.com/CARTAvis/carta-frontend/blob/dev/.github/pull_request_template.md).

In the description section, please provide details about your changes, including linked issues and companion pull requests (if there are), what is implemented or fixed, and how to test it.

Each check item in the checklist section is explained below:

For linked issues (if there are): this section is for checking the status of the issues that are linked in the above description.

-   assignee and label added: assign yourself to the issue you are working on. Add labels to the issue.

-   ZenHub issue connection, board status, and estimate updated: connect the issue to the pull request in ZenHub. ZenHub automatically updates the issue status from "In Progress" to "Review/QA" by default. Also, provide an estimate for the time required to complete the issue. This estimation is useful for future development planning.

For the pull request: this section is for checking the status of the pull request and reviewing the code changes.

-   reviewers and assignee added: assign reviewers and an assignee to the pull request. The assignee will be responsible for merging the pull request.

-   ZenHub estimate, milestone, and release (if needed) added: provide an estimate for the time required to review the pull request.

-   changelog updated / no changelog update needed: updating the changelog is required when the issue exists in the latest release and the changes have an impact on users. It is recommended to update the changelog when sending the pull request and to resolve changelog merge conflicts using the GitHub UI.

-   unit test added (for functions with no dependenies): it is recommended to add unit tests for functions that are related to the code changes.

-   API documentation added (for public variables and methods in stores): it is recommended to add API documentation for public variables and methods in stores that are related to the code changes. Check [here](./documentation-guidelines/#writing-api-documentation) for adding API documentation.

For dependencies: this section is for checking repositories that have dependencies on carta-frontend or are dependencies of carta-frontend.

-   e2e test passing / corresponding fix added: check if the end-to-end tests are passing. This will be checked during the review.

-   protobuf version bumped / no protobuf version bumped needed: updating the protobuf version is required when the behavior of the protobuf messages is changed.

-   protobuf updated to the latest dev commit / no protobuf update needed: updating the protobuf is required when there are changes in the carta-protobuf submodule. This can be done when the pull request is ready for merge. Check [here](#merging-a-pull-request-with-protobuf-changes-required) for the steps.

-   corresponding ICD test fix added (`BackendService` changed) / no ICD test fix needed (`BackendService` unchanged): updating ICD tests is required when there are changes in `BackendService`.

-   user manual prepared (for large new features): preparing user manual updates in advance is required for large new features.

To apply other [pull request templates](https://github.com/CARTAvis/carta-frontend/blob/dev/.github/PULL_REQUEST_TEMPLATE), please add a query parameter `&template=[template md file].md` to the URL.

#### CI checks

Please ensure that the CI passes successfully when making the pull request. The CI checks various items:

-   Codebase formatting: Check [here](./developer-tips/#checking-and-fixing-code-format) for automatic codebase formatting.
-   Production builds with different Node versions: The build will not be successful if the lint check fails. Check [here](./developer-tips/#code-linting) for details.
-   Documentation page formatting: Check [here](./documentation-guidelines/#formatting) for automatic formatting.
-   Production build of the documentation website: Details of building the website locally can be found [here](./documentation-guidelines/#building-documentation).

### Merging a pull request

The assignee of the pull request is responsible for merging the pull request. When merging the pull request, ensure the following:

-   Sufficient reviewers have approved the pull request.
-   All items in the checklist are completed.
-   All CI checks have passed successfully.

After merging the pull request, make sure to close the linked issue if necessary. GitHub automatically closes issues when they are linked properly. Remember to delete the branch after the merge.

#### Merging a pull request with protobuf changes required

If the pull request requires changes in the carta-protobuf submodule and is ready for merge, follow these steps:

1. Merge the carta-protobuf branch in the repository.

2. Check out the frontend branch:

    ```
    git checkout "[the frontend branch]"
    ```

3. Check out the dev branch of the protobuf submodule and pull the latest version:

    ```
    cd protobuf
    git checkout dev
    git pull
    cd ..
    ```

4. Commit and push the changes:

    ```
    git merge -a -m "update protobuf"
    git push
    ```

5. Finally, you can check the item "protobuf updated to the latest dev commit" in the check list. The pull request is ready for merge if all the other checklist items are completed and the CI checks have passed.

6. For the carta-backend repository, follow similar steps for the corresponding backend branch as in steps 2 to 5. Merge the frontend and backend pull requests simultaneously.
