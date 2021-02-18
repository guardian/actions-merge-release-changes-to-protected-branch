import * as core from '@actions/core';
import { exec } from '@actions/exec';
import * as github from '@actions/github';
import type {
	PullRequestEvent,
	PushEvent,
} from '@octokit/webhooks-definitions/schema';

const config = {
	pullRequestAuthor: 'jamie-lynch', // 'guardian-ci',
	pullRequestPrefix: 'chore(release):',
	maxFilesChanged: 2,
	maxFileChanges: 2,
	allowedFiles: ['package.json', 'package-lock.json', 'yarn.lock'],
	expectedChanges: ['-  "version": "', '+  "version": "'],
	releaseBranch: 'main',
	prTitlePrefix: 'chore(release): ',
	newBranchPrefix: 'release-',
	commitUser: 'guardian-ci',
	commitEmail: 'guardian-ci@users.noreply.github.com',
};

interface Package {
	version?: string;
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
 * Check that the PR is mergeable and, if it is, merge it
 *
 * @param object payload
 *
 * @throws Throws an error if the payload does not match any known conditions or if the underlying action throws an error
 */
const decideAndTriggerAction = () => {
	const eventName = github.context.eventName;
	const payload = github.context.payload;
	core.debug(`Event name: ${eventName}`);
	core.debug(`Action type: ${payload.action ?? 'Unknown'}`);

	switch (eventName) {
		case 'push':
			return checkAndReleaseLibrary(payload as PushEvent);
		case 'pull_request':
			return checkApproveAndMergePR(payload as PullRequestEvent);
		default:
			throw new Error(`Unknown eventName: ${eventName}`);
	}
};

const checkApproveAndMergePR = async (payload: PullRequestEvent) => {
	core.debug('checkApproveAndMergePR');
	core.debug(`Pull request: ${payload.pull_request.number}`);

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

	core.info(`Checking PR meets conditions`);
	if (
		!pullRequest.user ||
		pullRequest.user.login !== config.pullRequestAuthor
	) {
		core.info(
			`Pull request is not authored by ${config.pullRequestAuthor}, ignoring.`,
		);
		return;
	}

	if (!pullRequest.title.startsWith(config.pullRequestPrefix)) {
		core.info(
			`Pull request title does not start with "${config.pullRequestPrefix}", ignoring.`,
		);
		return;
	}

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

	core.info(`Conditions met. Approving.`);
	await octokit.pulls.createReview({
		...prData,
		event: 'APPROVE',
		body: 'Approved automatically by the @guardian/release-action',
	});

	core.info(`Checking if PR is mergeable`);
	if (!pullRequest.mergeable) {
		core.info(`Pull request is not mergeable, exiting.`);
		return;
	}

	core.info(`PR mergeable. Merging`);

	await octokit.pulls.merge(prData);
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
	core.debug('checkAndReleaseLibrary');
	const token = core.getInput('github-token');

	if (payload.ref !== `refs/heads/${config.releaseBranch}`) {
		core.info(`Push is not to ${config.releaseBranch}, ignoring`);
		return;
	}

	const ret = await exec('git diff --quiet', [], {
		ignoreReturnCode: true,
	});

	if (!ret) {
		core.info('New release not created. No further action needed.');
		return;
	}

	core.info('Diff detected. Opening pull request');

	core.startGroup('Getting version');
	let output = '';
	await exec('cat package.json', [], {
		listeners: {
			stdout: (data: Buffer) => {
				output += data.toString();
			},
		},
	});

	const newVersion = ((JSON.parse(output) as unknown) as Package).version;

	core.endGroup();

	if (!newVersion) {
		throw new Error('Could not find version number');
	}

	core.startGroup('Commiting changes');

	const message = `${config.prTitlePrefix}${newVersion}`;
	const newBranch = `${config.newBranchPrefix}${newVersion}`;

	await exec(`git config --global user.email "${config.commitEmail}"`);
	await exec(`git config --global user.name "${config.commitUser}"`);
	await exec(
		`git remote set-url origin "https://git:${token}@github.com/${payload.repository.full_name}.git"`,
	);

	await exec(`git checkout -b "${newBranch}"`);
	await exec(`git add package.json`);
	await exec(`git add package-lock.json`);
	await exec(`git commit -m "${message}"`);
	await exec(`git status`);
	await exec(`git push -u origin "${newBranch}"`);

	core.endGroup();

	const octokit = github.getOctokit(token);

	core.info('Creating pull request');
	await octokit.pulls.create({
		owner: payload.repository.owner.login,
		repo: payload.repository.name,
		title: message,
		body: `Updating the version number in the repository following the release of v${newVersion}`,
		base: config.releaseBranch,
		head: newBranch,
	});
};

async function run(): Promise<void> {
	try {
		core.info('Running @guardian/release');
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
