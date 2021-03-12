import * as core from '@actions/core';

export interface Config extends PackageManagerConfig {
	pullRequestAuthor: string;
	pullRequestPrefix: string;
	releaseBranch: string;
	newBranchPrefix: string;
	commitUser: string;
	commitEmail: string;
}
interface PackageManagerConfig {
	maxFilesChanged: number;
	maxFileChanges: number;
	allowedFiles: string[];
	expectedChanges: string[];
}

const packageManagerConfig: Record<string, PackageManagerConfig> = {
	npm: {
		maxFilesChanged: 2,
		maxFileChanges: 2,
		allowedFiles: ['package.json', 'package-lock.json'],
		expectedChanges: ['-  "version": "', '+  "version": "'],
	},
	yarn: {
		maxFilesChanged: 1,
		maxFileChanges: 2,
		allowedFiles: ['package.json'],
		expectedChanges: ['-  "version": "', '+  "version": "'],
	},
};

const allowedPackageManagerValues = Object.keys(packageManagerConfig);

const getConfigValue = (key: string, d: string) => {
	const input = core.getInput(key);

	return input && input !== '' ? input : d;
};

const getPackageManagerConfig = (): PackageManagerConfig => {
	const pm = getConfigValue('package-manager', 'npm');

	if (!allowedPackageManagerValues.includes(pm)) {
		throw new Error(
			`Invalid package-manager value (${pm}) provided. Allowed values are: ${allowedPackageManagerValues.join(
				', ',
			)}`,
		);
	}

	return packageManagerConfig[pm];
};

export const getConfig = (): Config => {
	return {
		...getPackageManagerConfig(),
		pullRequestAuthor: getConfigValue('pr-author', 'guardian-ci'),
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
