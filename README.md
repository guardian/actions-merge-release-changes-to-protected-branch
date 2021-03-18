# @guardian/actions-merge-release-changes-to-protected-branch

## Contents

-   [What?](#what)
-   [Why?](#why)
-   [How?](#how)
    -   [Tokens](#tokens)
    -   [Inputs](#inputs)
    -   [Repository Settings](#repository-settings)
    -   [Configuring Releases](#configuring-releases)
-   [Development](#development)
    -   [Build](#build)
    -   [Scripts](#scripts)

## What?

This action can be used as part of automating the publish process of node libraries to npm. It handles the version update of the `package.json` and `package-lock.json` files for repositories with protected release branches.

## Why?

When publishing a new release of a library to npm, the version number is changed in the `package.json` and `package-lock.json` files. When running the publish step on the release branch as part of CD, this means that changes are created during the CD process. To complete the step, these changes must be commited to the release branch. Many projects have branch protection enabled for the release branch which prevents these changes being commited directly. This action helps to automate the step, allowing the full publish process to be automated.

## How?

There are two steps in the process, both handled by this action:

1. If a merge to main results in a new publish, commit the changes to `package.json` and `package-lock.json` and open a new PR for them
2. If a new PR is opened, check if it a version bump PR and, if it is, approve it and merge it

Note that the merge step assumes that the status checks have already passed, that the configured approver meets any codeowner requirements and that there are no other requirements before merging. The action will attempt to merge the PR immediately after approving it so any unmet conditions will cause the process to fail. If there are any other requirements, these can be addressed in a job in the CI workflow which is added to the `needs` value of the approve and merge job. See the `Approve and merge PR` section for [an example of the `needs` value](#approve-and-merge-pr).

In order to run these steps, two workflow files are required in your project.

#### **Open PR**

On a merge to a release branch, your workflow should run the release and then call the action to PR the file changes. This assumes that the release process modifies the relevant files. More information on [configuring the release process](#configuring-releases) using [Semantic Release](https://github.com/semantic-release/semantic-release) is given below. An example config looks like:

```yaml
name: CD
on:
    push:
        branches:
            - main
jobs:
    CD:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v2
              with:
                  persist-credentials: false
            - name: 'Use Node.js 14'
              uses: actions/setup-node@v2.1.4
              with:
                  node-version: 14
            - name: Install dependencies
              run: npm ci
            - name: Release
              env:
                  GITHUB_TOKEN: ${{ secrets.GU_GITHUB_TOKEN }}
                  NPM_TOKEN: ${{ secrets.GU_NPM_TOKEN }}
              run: npm run release
            - name: Validate and open PR
              uses: guardian/actions-merge-release-changes-to-protected-branch@main
              with:
                  github-token: ${{ secrets.GU_GITHUB_TOKEN }}
```

#### **Approve and merge PR**

The PR approval and merge should be run on the `pull_request` event, for example:

```yaml
name: Approve
on:
    pull_request:
jobs:
    approve:
        runs-on: ubuntu-latest
        steps:
            - name: Validate and approve release PRs
              uses: guardian/actions-merge-release-changes-to-protected-branch@main
              with:
                  github-token: ${{ secrets.GITHUB_TOKEN }}
```

You probably want it to run after your other CI checks, e.g.

```yaml
name: CI
on:
    pull_request:
    workflow_dispatch:
jobs:
    ci:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v2
            - name: 'Use Node.js 14'
              uses: actions/setup-node@v2.1.4
              with:
                  node-version: 14
            - run: npm run test
    approve:
        runs-on: ubuntu-latest
        needs: [ci]
        steps:
            - name: Validate, approve and merge release PRs
              uses: guardian/actions-merge-release-changes-to-protected-branch@main
              with:
                  github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Tokens

Workflows completed using the `secrets.GITHUB_TOKEN` will not trigger other workflow actions, hence the use of `secrets.GU_GITHUB_TOKEN` for the step which opens the pull request. As merging the pull request does not need to trigger another step, the `secrets.GITHUB_TOKEN` can be used for this part.

### Inputs

| Name               | Description                                                                                                                                                                                                                                                        | Required | Default                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------ |
| github-token       | A GitHub token to complete the required actions                                                                                                                                                                                                                    | true     | -                                    |
| package-manager    | The name of the package manager used: npm, yarn                                                                                                                                                                                                                    | false    | npm                                  |
| additional-changes | A JSON object of additional changes where the key is a filename and the value is an array of acceptable changes in that file e.g. `{"README.md": ["- \"version\": \"", "+ \"version\": \""]}` (see [validating changes](#validating-changes) for more information) | false    | {}                                   |
| pr-author          | The author of version bump PRs                                                                                                                                                                                                                                     | false    | guardian-ci                          |
| pr-prefix          | The prefix to add to version bump PRs (note that a space will be added after the value)                                                                                                                                                                            | false    | chore(release):                      |
| release-branch     | The branch which releases are run from                                                                                                                                                                                                                             | false    | main                                 |
| branch-prefix      | The prefix to add to the branch name to commit version bump changes to                                                                                                                                                                                             | false    | release-                             |
| commit-user        | The username of the user to commit version bump changes with                                                                                                                                                                                                       | false    | guardian-ci                          |
| commit-email       | The email of the user to commit version bump changes with                                                                                                                                                                                                          | false    | guardian-ci@users.noreply.github.com |

### Validating Changes

In order to be sure that the PR being approved automatically is limited in scope to the expected changes in a release, the action performs so checks against the PR diff. These checks simply verify that a number of pre-configured strings are present in the diff.

For example, the diff for a version bump in the `package.json` might look something like this. By default, this action will verify that both `- \"version\": \"` and `+ \"version\": \"` appear in this diff.

```
"@@ -1,6 +1,6 @@\n {\n   \"name\": \"my-library\",\n-  \"version\": \"1.0.0\",\n+  \"version\": \"1.0.1\",\n   \"description\": \"This is a test library\",\n   \"main\": \"lib/index.js\","
```

The expected changes values provided through the `additional-changes` input are verified in the same way.

### Repository Settings

This action has been built for repositories that have branch protection set on their release branch(s). The following options are recommended:

-   Require pull request reviews before merging
-   Require status checks to pass before merging
-   Require branches to be up to date before merging
-   Include administrators

If you also have the `Require review from Code Owners` option enabled, you will need to add the PR author to the CODEOWNERS file. You can do this only for the files that will be changed during the release process.

### Configuring Releases

[Semantic Release](https://github.com/semantic-release/semantic-release) is the recommended tool for automating the release process. It provides support for a range of release scenarios and extensive plugins and configuration options for customising the process. Here we will show the recommended setup for a simple repository where a new version is released on every merge to main using GitHub Actions. Refer to the [Getting Started guide](https://github.com/semantic-release/semantic-release/blob/master/docs/usage/getting-started.md#getting-started) for more information of how to customise your setup.

1. Install `semantic-release` as a dev dependency

    ```
    yarn -D semantic-release
    ```

    or

    ```
    npm -D semantic-release
    ```

2. Add a release script to the `package.json`

    ```json
    {
        ...
        "scripts": {
            ...
            "release": "semantic-release",
            ...
        }
        ...
    }
    ```

3. Add a release configuration file: `release.config.js`

    ```js
    module.exports = {
        branches: ['main'],
        plugins: [
            '@semantic-release/commit-analyzer',
            '@semantic-release/release-notes-generator',
            '@semantic-release/npm',
            '@semantic-release/github',
        ],
    };
    ```

    This is the default configuration for Semantic Release and will carry out the following operations:

    - Verify the conditions of the release
    - Derive the new version to be released based on the commits since the last release
    - Generate release notes
    - Execute the `prepare` and `publish` steps

    For more information about this file, refer to the [semantic release configuration](https://github.com/semantic-release/semantic-release/blob/master/docs/usage/configuration.md#configuration) and [semantic release plugins](https://github.com/semantic-release/semantic-release/blob/master/docs/usage/plugins.md) documents.

4. Add workflow configuration

    Refer to the [configuration in the Open PR section](#open-pr) above. See the [Using semantic-release with GitHub Actions](https://github.com/semantic-release/semantic-release/blob/master/docs/recipes/github-actions.md) document for advice on alernative configuration. The tokens will need to be added as [GitHub secrets](https://docs.github.com/en/actions/reference/encrypted-secrets).

#### **Parsing Commit Messages**

The [semantic-release/commit-analyser](https://github.com/semantic-release/commit-analyzer) is used to determine the new version number for release from the commits since the last release using a commit convention. By default, the [angular convention](https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#-git-commit-guidelines) is used. Failure to conform to this convention can lead to new release versions which do not align with the scope of the change made. Because of this, it is recommended to utilise tooling to aid the user with crafting and verifying their commits and pull requests.

There are two main approaches that can be used:

1. Use confirming PR titles (with validation) and the squash-and-merge strategy
2. Use a tool to help and/or validate all commit messages

**PR Titles**

Using PR titles to denote the scope of the change brings the advantage that not every commit has to conform to the standard. It works on the preface the pull requests are merged using the [squash and merge](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/about-pull-request-merges#squash-and-merge-your-pull-request-commits) strategy. When this is done, the title of the pull request is used as the commit message to the base branch. To ensure that pull requests are always merged using this strategy, it is recommended that this be the only option allowed. This can be configured through the repository settings.

In order to validate that the PR title follows the convention, a status check can be added. The [amannn/action-semantic-pull-request](https://github.com/marketplace/actions/semantic-pull-request) is a simple way of doing this with `pull_request` being the recommended target. The `validateSingleCommit` option can be used to also validate the commit message for single commit PRs as this is the default value that GitHub will use for the commit message when squashing and merging.

```yaml
name: PR
on:
    pull_request:
        types:
            - opened
            - edited
            - synchronize
jobs:
    validate:
        runs-on: ubuntu-latest
        steps:
            - uses: amannn/action-semantic-pull-request@v3.4.0
              with:
                  validateSingleCommit: true
              env:
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Commit Messages**

When using commit messages to determine the new version, it is possible to either use conforming commits for every commit or only for a single commit within the pull request. The first strategy reduces the effort of the developer but makes it much harder to validate that the lack of conformity is deliberate.

To aid the process of crafting confirming commit messages, tools such as [commitizen](https://github.com/commitizen/cz-cli) can be used. This presents a command line interface at the point of comitting to craft commits following convention.

Alongside this, it would be worthwhile adding a process to verify that either at least one or all of the commits in a pull request conform to the spec depending on the strategy being employed. No tools of this nature have been used by the authors of this action to date and so no recommendations are made here. Contribtuions from those who have experience in this area are welcome.

## Development

### Build

At runtime, GitHub actions are downloaded from the repository and so the repository must contain everything required to run the project ([more on GitHub action delivery](https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action#commit-tag-and-push-your-action-to-github)). To avoid having to commit the `node_modules` directory, this project uses [@vercel/ncc](https://github.com/vercel/ncc) to compile the code into a single file along with the dependencies. Changes to the build should be included in the same commits that change the source code.

### Scripts

We follow the [script/task](https://github.com/github/scripts-to-rule-them-all) pattern, find useful scripts within the [script](https://github.com/guardian/actions-merge-release-changes-to-protected-branch/blob/main/script) directory for common tasks.

-   `./script/setup` to install dependencies
-   `./script/lint` to lint the code using ESLint
-   `./script/build` to compile TypeScript to JS
-   `./script/test` to run the test suite

There are also some other commands defined in package.json:

-   `npm run lint --fix` attempt to autofix any linter errors
-   `npm run prettier:check` and `npm run prettier:fix` to check and format the code using Prettier

However, it's advised you configure your IDE to format on save to avoid horrible "correct linting" commits.
