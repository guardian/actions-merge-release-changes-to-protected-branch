import * as core from '@actions/core';

export interface Config {
	pullRequestAuthor: string;
	pullRequestPrefix: string;
	maxFilesChanged: number;
	maxFileChanges: number;
	allowedFiles: string[];
	expectedChanges: string[];
	releaseBranch: string;
	newBranchPrefix: string;
	commitUser: string;
	commitEmail: string;
}

const getConfigValue = (key: string, d: string) => {
	const input = core.getInput(key);

	return input && input !== '' ? input : d;
};

export const getConfig = (): Config => {
	return {
		maxFilesChanged: 2,
		maxFileChanges: 2,
		allowedFiles: ['package.json', 'package-lock.json', 'yarn.lock'],
		expectedChanges: ['-  "version": "', '+  "version": "'],
		pullRequestAuthor: getConfigValue('pr-author', 'jamie-lynch'), // 'guardian-ci',
		pullRequestPrefix: getConfigValue('pr-prefix', 'chore(release):'),
		releaseBranch: getConfigValue('release-branch', 'main'),
		newBranchPrefix: getConfigValue('branch-prefix', 'release-'),
		commitUser: getConfigValue('commit-user', 'guardian-ci'),
		commitEmail: getConfigValue(
			'commit-email',
			'guardian-ci@users.noreply.github.com',
		),
	};
};
