import * as core from '@actions/core';

export interface Config extends FileChangesConfig {
	pullRequestAuthor: string;
	pullRequestPrefix: string;
	releaseBranch: string;
	newBranchPrefix: string;
	commitUser: string;
	commitEmail: string;
}

type FileChanges = Record<string, string[]>;

interface FileChangesConfig {
	expectedChanges: FileChanges;
}

const versionBumpChange = ['-  "version": "', '+  "version": "'];

const packageManagerConfig: Record<string, FileChanges> = {
	npm: {
		'package.json': versionBumpChange,
		'package-lock.json': versionBumpChange,
	},
	yarn: {
		'package.json': versionBumpChange,
	},
};

const allowedPackageManagerValues = Object.keys(packageManagerConfig);

const getConfigValue = (key: string, d: string) => {
	const input = core.getInput(key);

	return input && input !== '' ? input : d;
};

const getFileChangesConfig = (): FileChangesConfig => {
	const pm = getConfigValue('package-manager', 'npm');

	if (!allowedPackageManagerValues.includes(pm)) {
		throw new Error(
			`Invalid package-manager value (${pm}) provided. Allowed values are: ${allowedPackageManagerValues.join(
				', ',
			)}`,
		);
	}
	const pmChanges = packageManagerConfig[pm];

	return { expectedChanges: { ...getAdditionalChanges(), ...pmChanges } };
};

const getAdditionalChanges = (): FileChanges => {
	const additionalChanges = getConfigValue('additional-changes', '{}');

	return parseAdditionalChanges(additionalChanges);
};

export const parseAdditionalChanges = (
	additionalChanges: string,
): FileChanges => {
	if (!additionalChanges || additionalChanges === '{}') {
		return {};
	}

	let json;
	try {
		// eslint-disable-next-line prefer-const -- this is setting the value above so I don't know what eslint is complaining about
		json = JSON.parse(additionalChanges) as FileChanges;
	} catch (err) {
		throw new Error('Invalid JSON provided for additional-changes input');
	}

	if (json !== Object(json) || Array.isArray(json)) {
		throw new Error('additional-changes value must be an object');
	}

	for (const changes of Object.values(json)) {
		if (!Array.isArray(changes)) {
			throw new Error(
				'values in additional-changes object must be arrays',
			);
		}

		for (const change of changes) {
			if (typeof change !== 'string') {
				throw new Error(
					'values in additional-changes object must be strings',
				);
			}
		}
	}

	return json;
};

export const getConfig = (): Config => {
	return {
		...getFileChangesConfig(),
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
