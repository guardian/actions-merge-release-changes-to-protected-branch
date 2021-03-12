import { debug, endGroup, info, startGroup } from '@actions/core';
import { exec } from '@actions/exec';
import type { PushEvent } from '@octokit/webhooks-definitions/schema';
import type { PackageJson } from 'type-fest';
import type { Config } from '../config';
import { octokit, token } from '../lib/github';

interface Props {
	payload: PushEvent;
	config: Config;
}

export const raisePullRequest = async ({
	payload,
	config,
}: Props): Promise<void> => {
	debug('raisePullRequest');

	/*************************************/

	info('Checking for a release branch');

	if (payload.ref !== `refs/heads/${config.releaseBranch}`) {
		info(`Push is not to ${config.releaseBranch}, ignoring`);
		return;
	}

	/*************************************/

	info('Checking changes');

	if (
		!(await exec('git diff --quiet', [], {
			ignoreReturnCode: true,
		}))
	) {
		info('New release not created. No further action needed.');
		return;
	}

	/*************************************/

	info('Changes detected. Creating pull request');

	/*************************************/

	startGroup('Getting new package version');

	let output = '';
	await exec('cat package.json', [], {
		listeners: {
			stdout: (data: Buffer) => {
				output += data.toString();
			},
		},
	});

	const { version: newVersion } = JSON.parse(output) as PackageJson;

	if (!newVersion) {
		throw new Error('Could not find version number');
	}

	endGroup();

	/*************************************/

	startGroup('Committing changes');

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

	/*************************************/

	info('Opening pull request');

	/*************************************/

	await octokit.pulls.create({
		owner: payload.repository.owner.login,
		repo: payload.repository.name,
		title: message,
		body: `Updating the version number in the repository following the release of v${newVersion}`,
		base: config.releaseBranch,
		head: newBranch,
	});
};
