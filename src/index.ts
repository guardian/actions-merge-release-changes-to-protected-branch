import * as core from '@actions/core';
import { exec } from '@actions/exec';
import * as github from '@actions/github';
import type { Endpoints } from '@octokit/types';
import type {
	CheckSuiteEvent,
	PullRequestEvent,
	PullRequestReviewEvent,
	PushEvent,
} from '@octokit/webhooks-definitions/schema';

const config = {
	pullRequestAuthor: 'jamie-lynch', // 'guardian-ci',
	pullRequestPrefix: 'chore(release):',
	maxFilesChanged: 2,
	maxFileChanges: 2,
	allowedFiles: ['package.json', 'package-lock.json', 'yarn.lock'],
	expectedChanges: ['-  "description": "', '+  "description": "'], // ['-  "version": "', '+  "version": "'],
	releaseBranch: 'jl/test-push', // 'main
	prTitlePrefix: 'chore(release): ',
	newBranchPrefix: 'release-',
};

type PullRequest = Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}']['response']['data'];

interface PullRequestQueryData {
	owner: string;
	repo: string;
	pull_number: number;
}

interface Package {
	version?: string;
}

const isAutoBumpPR = (pullRequest: PullRequest): boolean => {
	if (
		!pullRequest.user ||
		pullRequest.user.login !== config.pullRequestAuthor
	) {
		console.log(
			`Pull request is not authored by ${config.pullRequestAuthor}, ignoring.`,
		);
		return false;
	}

	if (!pullRequest.title.startsWith(config.pullRequestPrefix)) {
		console.log(
			`Pull request title does not start with "${config.pullRequestPrefix}", ignoring.`,
		);
		return false;
	}

	return true;
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
			return checkAndReleaseLibrary(payload as PushEvent);
		case 'pull_request':
			return validateAndApproveReleasePR(payload as PullRequestEvent);
		case 'check_suite':
		case 'pull_request_review':
			return validateAndMergePRs(
				payload as PullRequestReviewEvent | CheckSuiteEvent,
				github.context.eventName,
			);
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
const validateAndApproveReleasePR = async (payload: PullRequestEvent) => {
	console.log('validateAndApproveReleasePR');
	console.log(`Pull request: ${payload.pull_request.number}`);

	const prData = {
		owner: payload.repository.owner.login,
		repo: payload.repository.name,
		pull_number: payload.pull_request.number,
	};

	const token = core.getInput('github-token');
	const octokit = github.getOctokit(token);

	// PR information isn't necessarily up to date in webhook payload
	// Get PR from the API to be sure
	const { data: pullRequest } = await octokit.pulls.get(prData);

	if (!isAutoBumpPR(pullRequest)) return;

	if (pullRequest.changed_files > config.maxFilesChanged) {
		throw new Error(
			`Pull request changes more than ${config.maxFilesChanged} files.`,
		);
	}

	const { data: files } = await octokit.pulls.listFiles(prData);

	for (const file of files) {
		if (!config.allowedFiles.includes(file.filename)) {
			throw new Error(
				`Unallowed file (${
					file.filename
				}) changed. Allowed files are: ${config.allowedFiles.join(
					', ',
				)}`,
			);
		}

		if (file.changes > config.maxFileChanges) {
			throw new Error(
				`More than ${config.maxFileChanges} in file: ${file.filename}`,
			);
		}

		if (file.patch) {
			for (const change of config.expectedChanges) {
				if (!file.patch.includes(change)) {
					throw new Error(
						`Expected to see the following string in diff for ${file.filename}: ${change}`,
					);
				}
			}
		}
	}

	await octokit.pulls.createReview({
		...prData,
		event: 'APPROVE',
		body: 'Approved automatically by the @guardian/release-action',
	});
};

/**
 * Handle the different payloads depending on event and call the validateAndMergePR
 * function accordingly
 *
 * @param object payload
 * @param string eventType
 */
const validateAndMergePRs = async (
	payload: PullRequestReviewEvent | CheckSuiteEvent,
	eventType: string,
) => {
	const repoData = {
		owner: payload.repository.owner.login,
		repo: payload.repository.name,
	};

	if (eventType === 'pull_request_review') {
		const p = payload as PullRequestReviewEvent;
		if (p.action !== 'submitted' || p.review.state !== 'approved') {
			console.log('Review was not approval submission, ignoring');
			return;
		}

		await validateAndMergePR({
			...repoData,
			pull_number: p.pull_request.number,
		});
	} else if (eventType === 'check_suite') {
		const p = payload as CheckSuiteEvent;
		if (p.action !== 'completed' || p.check_suite.status !== 'completed') {
			console.log(`Check suite not completed successfully, ignoring`);
			return;
		}

		for await (const pr of p.check_suite.pull_requests) {
			await validateAndMergePR({ ...repoData, pull_number: pr.number });
		}
	}
};

/**
 * Check if a PR meets the criteria for auto merge and, if it does, merge it
 *
 * Checks:
 * 1. Check if a PR is an automatically opened version bump PR
 * 2. Check if the PR is mergeable
 *
 * @param object payload
 */
const validateAndMergePR = async (
	pullRequestQueryData: PullRequestQueryData,
) => {
	console.log(`Pull request: ${pullRequestQueryData.pull_number}`);
	const token = core.getInput('github-token');
	const octokit = github.getOctokit(token);

	const { data: pullRequest } = await octokit.pulls.get({
		...pullRequestQueryData,
	});

	if (!isAutoBumpPR(pullRequest)) return;

	if (!pullRequest.mergeable) {
		console.log(`Pull request is not mergeable, exiting.`);
		return;
	}

	await octokit.pulls.merge({
		...pullRequestQueryData,
		pull_number: pullRequest.number,
	});
};

/**
 * Run any preflight checks, release the library to npm and open a PR to bump the version in the package.json
 *
 * Checks:
 * 1. The branch ${config.releaseBranch}
 * 2. There is a diff
 *
 * @param object payload
 *
 * @throws Throws an error if any of the preflight checks or the release process fail
 */
const checkAndReleaseLibrary = async (payload: PushEvent) => {
	console.log('checkAndReleaseLibrary');

	if (payload.ref !== `refs/heads/${config.releaseBranch}`) {
		console.log(`Push is not to ${config.releaseBranch}, ignoring`);
		return;
	}

	let output = '';
	const options = {
		listeners: {
			stdout: (data: Buffer) => {
				output += data.toString();
			},
		},
	};

	await exec('git diff --quiet', [], options);

	// if (!output) {
	// 	console.log('New release not created. No further action needed.');
	// 	return;
	// }

	console.log('Diff detected. Opening pull request');

	output = '';
	await exec('cat package.json', [], options);

	const newVersion = ((JSON.parse(output) as unknown) as Package).version;

	if (!newVersion) {
		console.log('Could not find version number');
		return;
	}

	const message = `${config.prTitlePrefix}${newVersion}`;
	const newBranch = `${config.newBranchPrefix}${newVersion}`;

	await exec(`git checkout -b "${newBranch}"`);
	await exec(`touch test.md`);
	await exec(`git add test.md`);
	// await exec(`git add package.json`);
	// await exec(`git add package-lock.json`);
	await exec(`git commit -m "${message}"`);
	await exec(`git status`);
};

async function run(): Promise<void> {
	try {
		console.log('Running @guardian/release');
		await decideAndTriggerAction();
	} catch (error) {
		if (error instanceof Error) {
			core.setFailed(error.message);
		} else {
			throw error;
		}
	}
}

void run();
