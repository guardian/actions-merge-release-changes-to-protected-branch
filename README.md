# @guardian Release

## What?

tbd

## Why?

tbd

## How?

tbd

## Questions

-   Should this be one command that figures out what to do based on the situation or multiple commands?

## TODOs

-   ~Write in TS~
-   ~Add linting and all the other fun things~
-   ~Investigate using [@vercel/ncc](https://github.com/vercel/ncc) instead of checking in node_modules~
-   Check that the only change made in files is a version bump
-   ~Approve the PR~
-   Investigate implementing the release process part
-   Use @actions/core to do logging
-   Take items from config object as optional inputs
-   Provide option for the release branch?
-   Account for files not being in the root directory
-   Cater for other libraries (maven, etc.)
-   Upload artefacts
-   Run the build automagically
-   Write a proper README

## Development

We follow the [script/task](https://github.com/github/scripts-to-rule-them-all) pattern, find useful scripts within the [script](https://github.com/guardian/release-action/blob/main/script) directory for common tasks.

-   `./script/setup` to install dependencies
-   `./script/lint` to lint the code using ESLint
-   `./script/build` to compile TypeScript to JS

There are also some other commands defined in package.json:

-   `npm run lint --fix` attempt to autofix any linter errors
-   `npm run prettier:check` and `npm run prettier:fix` to check and format the code using Prettier

However, it's advised you configure your IDE to format on save to avoid horrible "correct linting" commits.
