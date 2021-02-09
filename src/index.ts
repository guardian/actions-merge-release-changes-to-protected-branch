import * as core from '@actions/core';
import * as github from '@actions/github';
import type { PullRequestEvent } from '@octokit/webhooks-definitions/schema';

const config = {
	pullRequestAuthor: 'guardian-ci',
	pullRequestPrefix: 'chore(release):',
	maxFilesChanged: 2,
};

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
const decideAndTriggerAction = () => {
	const eventName = github.context.eventName;
	const payload = github.context.payload;
	console.log(`Event name: ${eventName}`);
	console.log(`Action type: ${payload.action ?? 'Unknown'}`);

	switch (eventName) {
		case 'push':
			return checkAndReleaseLibrary();
		case 'pull_request':
			return validateAndApproveReleasePR(payload as PullRequestEvent);
		default:
			throw new Error(`Unknown eventName: ${eventName}`);
	}
};

/**
 * Check if a PR meets the criteria for auto approval and, if it does, aprove it
 *
 * Firstly, check if the PR was generated automatically by the release process to bump the version number.
 * If it wasn't then exit log the outcome and exit.
 * If it was then check that the PR only makes acceptable changes. Throw an error if not.
 *
 * Checks:
 * 1. Pull request is authored by ${config.pullRequestAuthor}
 * 2. Pull request title starts with ${config.pullRequestPrefix}
 * 3. Pull request doesn't change more than ${config.maxFilesChanged} files
 *
 * @param object payload
 *
 * @throws Throws an error if the PR was flagged for auto approval but failed one of the checks
 */
const validateAndApproveReleasePR = (payload: PullRequestEvent) => {
	console.log('validateAndApproveReleasePR');
	console.log(`Pull request: ${payload.pull_request.number}`);

	if (payload.pull_request.user.login !== config.pullRequestAuthor) {
		console.log(
			`Pull request is not authored by ${config.pullRequestAuthor}, ignoring.`,
		);
		return;
	}

	if (!payload.pull_request.title.startsWith(config.pullRequestPrefix)) {
		console.log(
			`Pull request title does not start with "${config.pullRequestPrefix}", ignoring.`,
		);
		return;
	}

	if (payload.pull_request.changed_files > config.maxFilesChanged) {
		throw new Error(
			`Pull request changes more than ${config.maxFilesChanged} files.`,
		);
	}
};

/**
 * Run any preflight checks, release the library to npm and open a PR to bump the version in the package.json
 *
 * @param object payload
 *
 * @throws Throws an error if any of the preflight checks or the release process fail
 */
const checkAndReleaseLibrary = () => {
	console.log('checkAndReleaseLibrary');
};

function run(): void {
	try {
		console.log('Running @guardian/release');
		decideAndTriggerAction();
	} catch (error) {
		if (error instanceof Error) {
			core.setFailed(error.message);
		} else {
			throw error;
		}
	}
}

run();
