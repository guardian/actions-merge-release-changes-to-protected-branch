import * as core from '@actions/core';
import { exec } from '@actions/exec';
import * as github from '@actions/github';
import type {
	PullRequestEvent,
	PushEvent,
	Repository,
} from '@octokit/webhooks-definitions/schema';
import type { Config } from './config';
import { getConfig } from './config';

interface Package {
	version?: string;
}

const decideAndTriggerAction = (config: Config) => {
	const eventName = github.context.eventName;
	const payload = github.context.payload;
	core.debug(`Event name: ${eventName}`);
	core.debug(`Action type: ${payload.action ?? 'Unknown'}`);

	switch (eventName) {
		case 'push':
			return checkAndPRChanges(payload as PushEvent, config);
		case 'pull_request':
			return checkApproveAndMergePR(payload as PullRequestEvent, config);
		default:
			throw new Error(`Unknown eventName: ${eventName}`);
	}
};

const decideMergeMethod = (
	repository: Repository,
): 'merge' | 'squash' | 'rebase' => {
	if (repository.allow_merge_commit) {
		return 'merge';
	}

	if (repository.allow_squash_merge) {
		return 'squash';
	}

	if (repository.allow_rebase_merge) {
		return 'rebase';
	}

	return 'merge';
};

const checkApproveAndMergePR = async (
	payload: PullRequestEvent,
	config: Config,
) => {
	core.debug('checkApproveAndMergePR');
	core.debug(`Pull request: ${payload.pull_request.number}`);

	const prData = {
		owner: payload.repository.owner.login,
		repo: payload.repository.name,
		pull_number: payload.pull_request.number,
	};

	const token = core.getInput('github-token', { required: true });
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

	const allowedFiles = Object.keys(config.expectedChanges);
	const expectedFilesChanges = allowedFiles.length;

	// Although this case would be caught implicity by the following checks
	// checking it at this stage means that we can fail early and avoid
	// calling the listFiles endpoint
	if (pullRequest.changed_files !== expectedFilesChanges) {
		throw new Error(
			`Pull request changes ${
				pullRequest.changed_files
			} files. Expected to see changes to all of the following files: ${allowedFiles.join(
				', ',
			)}`,
		);
	}

	const { data: files } = await octokit.pulls.listFiles(prData);

	for (const file of files) {
		if (!allowedFiles.includes(file.filename)) {
			throw new Error(
				`Unallowed file (${
					file.filename
				}) changed. Allowed files are: ${allowedFiles.join(', ')}`,
			);
		}

		const expectedChanges = config.expectedChanges[file.filename];

		if (file.changes !== expectedChanges.length) {
			throw new Error(
				`${file.changes} change(s) in file: ${file.filename}. Expected ${expectedChanges.length}`,
			);
		}

		if (file.patch) {
			for (const change of expectedChanges) {
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
		body:
			'Approved automatically by the @guardian/actions-merge-release-changes-to-protected-branch',
	});

	core.info(`Checking if PR is mergeable`);
	if (!pullRequest.mergeable) {
		core.info(`Pull request is not mergeable, exiting.`);
		return;
	}

	core.info(`PR mergeable. Merging`);

	await octokit.pulls.merge({
		...prData,
		merge_method: decideMergeMethod(payload.pull_request.base.repo),
	});
};

const checkAndPRChanges = async (payload: PushEvent, config: Config) => {
	core.debug('checkAndReleaseLibrary');
	const token = core.getInput('github-token', { required: true });

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

	const message = `${config.pullRequestPrefix} ${newVersion}`;
	const newBranch = `${config.newBranchPrefix}${newVersion}`;

	await exec(`git config --global user.email "${config.commitEmail}"`);
	await exec(`git config --global user.name "${config.commitUser}"`);
	await exec(
		`git remote set-url origin "https://git:${token}@github.com/${payload.repository.full_name}.git"`,
	);

	await exec(`git checkout -b "${newBranch}"`);

	for (const file of Object.keys(config.expectedChanges)) {
		await exec(`git add ${file}`);
	}

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
		core.info(
			'Running @guardian/actions-merge-release-changes-to-protected-branch',
		);
		const config = getConfig();
		await decideAndTriggerAction(config);
	} catch (error) {
		if (error instanceof Error) {
			core.setFailed(error.message);
		} else {
			throw error;
		}
	}
}

void run();
