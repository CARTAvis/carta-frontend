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

In the description section, please provide details about your changes, including linked issues and companion PRs (if there are), what is implemented or fixed, and how to test it.

Each check item in the checklist section is explained below:

For linked issues (if there are):

-   assignee and label added:

    Assign yourself to the issue you are working on. Add labels to the issue.

-   ZenHub issue connection, board status, and estimate updated:

    Connect the issue to the pull request in ZenHub. ZenHub automatically updates the issue status from "In Progress" to "Review/QA" by default. Also, provide an estimate for the time required to complete the issue. This estimation is useful for future development planning.

For the pull request:

-   reviewers and assignee added:

    Assign reviewers and an assignee to the pull request. The assignee will be responsible for merging the pull request.

-   ZenHub estimate, milestone, and release (if needed) added:

    Provide an estimate for the time required to review the pull request.

-   e2e test passing / corresponding fix added:

    Check if the end-to-end tests are passing. This will be checked during the review.

-   changelog updated / no changelog update needed:

    Updating the changelog is required when the issue exists in the latest release and the changes have an impact on users. It can be updated when the pull request is ready for merge to prevent frequent merge conflicts.

-   protobuf updated to the latest dev commit / no protobuf update needed:

    Updating the protobuf is required when there are changes in the carta-protobuf submodule. This can be done when the pull request is ready for merge.

-   `BackendService` unchanged / `BackendService` changed and corresponding ICD test fix added:

    Updating ICD tests is required when there are changes in `BackendService`.

#### CI checks

Please ensure that the CI passes successfully when making the pull request. The CI checks various items:

-   Codebase formatting: Check [here](./developer-tips.md/#checking-and-fixing-code-format) for automatic codebase formatting.
-   Production builds with different Node versions: The build will not be successful if the lint check fails. Check [here](./developer-tips.md/#code-linting) for details.
-   Documentation page formatting: Check [here](./documentation-guidelines.md/#writing-documentation-pages) for automatic formatting.
-   Production build of the documentation website: Details of building the website locally can be found [here](./documentation-guidelines.md/#building-documentaiton).

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
