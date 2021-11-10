import { getInput } from '@actions/core';

enum PackageManager {
	NPM = 'npm',
	YARN = 'yarn',
}

const PackageManagers: string[] = Object.values(PackageManager);

export interface Config extends FileChangesConfig {
	pullRequestAuthor: string;
	pullRequestPrefix: string;
	releaseBranch: string;
	newBranchPrefix: string;
	commitUser: string;
	commitEmail: string;
}

type FileChanges = Record<string, string[] | '*'>;

interface FileChangesConfig {
	expectedChanges: FileChanges;
}

const versionBumpChange = ['-  "version": "', '+  "version": "'];

const npmLockfileChanges = (npmLockfileVersion: number): string[] => {
	switch (npmLockfileVersion) {
		case 1: {
			return versionBumpChange;
		}
		case 2: {
			/*
			The v2 npm lockfile contains the version of a package twice:
				- `.version`
			  	- `.packages."".version`

			As a result, we expect more changes.
			 */
			return [...versionBumpChange, ...versionBumpChange];
		}
		default:
			throw new Error(
				`NPM lockfile version ${npmLockfileVersion} is not supported. Contributions welcome!`,
			);
	}
};

const packageManagerConfig = (
	npmLockfileVersion: number,
): Record<PackageManager, FileChanges> => {
	const packageJsonChanges: FileChanges = {
		'package.json': versionBumpChange,
	};

	return {
		[PackageManager.YARN]: packageJsonChanges,
		[PackageManager.NPM]: {
			...packageJsonChanges,
			'package-lock.json': npmLockfileChanges(npmLockfileVersion),
		},
	};
};

const getConfigValueOrDefault = (key: string, d: string): string => {
	const input = getInput(key);

	return input && input !== '' ? input : d;
};

const parseAdditionalChanges = (additionalChanges: string): FileChanges => {
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
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Typescript thinks this has to be true but we're parsing JSON so let's make sure
		if (!Array.isArray(changes) && changes !== '*') {
			throw new Error(
				'values in additional-changes object must be arrays or "*"',
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

const parseIntOrDefault = (value: string, defaultValue: number): number =>
	isNaN(parseInt(value)) ? defaultValue : parseInt(value);

const getFileChangesConfig = (): FileChangesConfig => {
	const pm: PackageManager = getConfigValueOrDefault(
		'package-manager',
		'npm',
	) as PackageManager;

	if (!PackageManagers.includes(pm)) {
		throw new Error(
			`Invalid package-manager value (${pm}) provided. Allowed values are: ${PackageManagers.join(
				', ',
			)}`,
		);
	}

	const defaultNpmLockfileVersion = 1;
	const npmLockfileVersionInput: number = parseIntOrDefault(
		getConfigValueOrDefault(
			'npm-lockfile-version',
			defaultNpmLockfileVersion.toString(),
		),
		defaultNpmLockfileVersion,
	);

	const pmConfig = packageManagerConfig(npmLockfileVersionInput);

	const pmChanges = pmConfig[pm];

	return { expectedChanges: { ...getAdditionalChanges(), ...pmChanges } };
};

const getAdditionalChanges = (): FileChanges => {
	const additionalChanges = getConfigValueOrDefault(
		'additional-changes',
		'{}',
	);

	return parseAdditionalChanges(additionalChanges);
};

export const getConfig = (): Config => {
	return {
		...getFileChangesConfig(),
		pullRequestAuthor: getConfigValueOrDefault('pr-author', 'guardian-ci'),
		pullRequestPrefix: getConfigValueOrDefault(
			'pr-prefix',
			'chore(release):',
		),
		releaseBranch: getConfigValueOrDefault('release-branch', 'main'),
		newBranchPrefix: getConfigValueOrDefault('branch-prefix', 'release-'),
		commitUser: getConfigValueOrDefault('commit-user', 'guardian-ci'),
		commitEmail: getConfigValueOrDefault(
			'commit-email',
			'guardian-ci@users.noreply.github.com',
		),
	};
};

export const _ = {
	getConfigValueOrDefault,
	getFileChangesConfig,
	parseAdditionalChanges,
};
