import { info, debug, getInput, startGroup, endGroup } from '@actions/core';
import { exec } from '@actions/exec';
import { getOctokit } from '@actions/github';
import type { PushEvent } from '@octokit/webhooks-definitions/schema';
import type { Config } from '../config';

interface Package {
	version?: string;
}

export const raisePullRequest = async (payload: PushEvent, config: Config) => {
	debug('checkAndReleaseLibrary');
	const token = getInput('github-token', { required: true });

	if (payload.ref !== `refs/heads/${config.releaseBranch}`) {
		info(`Push is not to ${config.releaseBranch}, ignoring`);
		return;
	}

	const ret = await exec('git diff --quiet', [], {
		ignoreReturnCode: true,
	});

	if (!ret) {
		info('New release not created. No further action needed.');
		return;
	}

	info('Diff detected. Opening pull request');

	startGroup('Getting version');
	let output = '';
	await exec('cat package.json', [], {
		listeners: {
			stdout: (data: Buffer) => {
				output += data.toString();
			},
		},
	});

	const newVersion = ((JSON.parse(output) as unknown) as Package).version;

	endGroup();

	if (!newVersion) {
		throw new Error('Could not find version number');
	}

	startGroup('Commiting changes');

	const message = `${config.pullRequestPrefix} ${newVersion}`;
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

	endGroup();

	const octokit = getOctokit(token);

	info('Creating pull request');
	await octokit.pulls.create({
		owner: payload.repository.owner.login,
		repo: payload.repository.name,
		title: message,
		body: `Updating the version number in the repository following the release of v${newVersion}`,
		base: config.releaseBranch,
		head: newBranch,
	});
};
