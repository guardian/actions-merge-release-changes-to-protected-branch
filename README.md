# @guardian/post-release-action

**This project is still a WIP and should not be used on any production repositories**

## What?

This action can be used as part of automating the publish process of node libraries to npm. It handles the version update of the `package.json` and `package-lock.json` files for repositories with protected release branches.

## Why?

When publishing a new release of a library to npm, the version number is changed in the `package.json` and `package-lock.json` files. When running the publish step on the release branch as part of CD, this means that changes are created during the CD process. To complete the step, these changes must be commited to the release branch. Many projects have branch protection enabled for the release branch which prevents these changes being commited directly. This action helps to automate the step, allowing the full publish process to be automated.

## How?

There are two steps in the process, both handled by this action:

1. If a merge to main results in a new publish, commit the changes to `package.json` and `package-lock.json` and open a new PR for them
2. If a new PR is opened, check if it a version bump PR and, if it is, approve it and merge it

In order to run these steps, two workflow files are required in your project.

**Open PR**

On a merge to a release branch, your workflow should run the release and then call the action to PR the file changes. This assumes that the release process modifies the relevant files. [Semantic release](https://github.com/semantic-release/semantic-release) is the recommended release tool. An example config looks like:

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
            - name: Release
              env:
                  GITHUB_TOKEN: ${{ secrets.CI_TOKEN_1 }}
                  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
              run: npm run release
            - name: Validate and open PR
              uses: guardian/post-release-action@main
              with:
                  github-token: ${{ secrets.CI_TOKEN_1 }}
```

**Approve and merge PR**

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
              uses: guardian/post-release-action@main
              with:
                  github-token: ${{ secrets.CI_TOKEN_2 }}
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
              uses: guardian/post-release-action@main
              with:
                  github-token: ${{ secrets.CI_TOKEN_2 }}
```

### Tokens

Workflows completed using the `secrets.GITHUB_TOKEN` will not trigger other workflow actions, hence the use of `secrets.CI_TOKEN_*`. Two tokens are required as a user cannot approve their own pull request.

### Inputs

| Name            | Description                                                            | Required | Default                              |
| --------------- | ---------------------------------------------------------------------- | -------- | ------------------------------------ |
| github-token    | A GitHub token to complete the required actions                        | true     | -                                    |
| package-manager | The name of the package manager used: npm, yarn                        | false    | npm                                  |
| pr-author       | The author of version bump PRs                                         | false    | guardian-ci                          |
| pr-prefix       | The prefix to add to version bump PRs                                  | false    | chore(release):                      |
| release-branch  | The branch which releases are run from                                 | false    | main                                 |
| branch-prefix   | The prefix to add to the branch name to commit version bump changes to | false    | release-                             |
| commit-user     | The username of the user to commit version bump changes with           | false    | guardian-ci                          |
| commit-email    | The email of the user to commit version bump changes with              | false    | guardian-ci@users.noreply.github.com |

### Repository Settings

This action has been built for repositories that have branch protection set on their release branch(s). The following options are recommended:

-   Require pull request reviews before merging
-   Require status checks to pass before merging
-   Require branches to be up to date before merging
-   Include administrators

If you also have the `Require review from Code Owners` option enabled, you will need to add the PR author to the CODEOWNERS file. You can do this only for the files that will be changed during the release process.

## Development

We follow the [script/task](https://github.com/github/scripts-to-rule-them-all) pattern, find useful scripts within the [script](https://github.com/guardian/post-release-action/blob/main/script) directory for common tasks.

-   `./script/setup` to install dependencies
-   `./script/lint` to lint the code using ESLint
-   `./script/build` to compile TypeScript to JS

There are also some other commands defined in package.json:

-   `npm run lint --fix` attempt to autofix any linter errors
-   `npm run prettier:check` and `npm run prettier:fix` to check and format the code using Prettier

However, it's advised you configure your IDE to format on save to avoid horrible "correct linting" commits.
