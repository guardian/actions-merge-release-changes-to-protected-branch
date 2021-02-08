const core = require('@actions/core');
const github = require('@actions/github');

try {
  console.log('Running @guardian/release');
  decideAndTriggerAction(github.context.payload);
} catch (error) {
  core.setFailed(error.message);
}

/**
 * Decide what to do depending on the payload received
 *
 * For pushes to main, run preflight checks and then, if successful, release the
 * library to npm and open a new PR to bump the version in the package.json
 *
 * For pull requests, check if the PR matches the pattern for a version bump.
 * If it does then validate the PR to make sure it meets the requirements and,
 * if it does, approve it
 *
 * @param object payload
 *
 * @throws Throws an error if the payload does not match any known conditions or if the underlying action throws an error
 */
const decideAndTriggerAction = (payload) => {};

/**
 * Check if a PR meets the criteria for auto approval and, if it does, aprove it
 *
 * Firstly, check if the PR was generated automatically by the release process to bump the version number.
 * If it wasn't then exit log the outcome and exit.
 * If it was then check that the PR only makes acceptable changes. Throw an error if not.
 *
 * @param object payload
 *
 * @throws Throws an error if the PR was flagged for auto approval but failed one of the checks
 */
const validateAndApproveReleasePR = (payload) => {};

/**
 * Run any preflight checks, release the library to npm and open a PR to bump the version in the package.json
 *
 * @param object payload
 *
 * @throws Throws an error if any of the preflight checks or the release process fail
 */
const checkAndReleaseLibrary = (payload) => {};
