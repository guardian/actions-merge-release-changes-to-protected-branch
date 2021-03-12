import { debug, info } from '@actions/core';
import type { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';
import type { Config } from '../config';
import type { PRData } from '../index';
import { octokit } from '../lib/github';
import { pluralise } from '../lib/pluralise';

interface Props {
	pullRequest: GetResponseDataTypeFromEndpointMethod<
		typeof octokit.pulls.get
	>;
	config: Config;
	prData: PRData;
}

export const validatePullRequest = async ({
	pullRequest,
	config,
	prData,
}: Props): Promise<void> => {
	debug('validatePullRequest');

	info('Checking pull request is valid');

	/*************************************/

	if (
		!pullRequest.user ||
		pullRequest.user.login !== config.pullRequestAuthor
	) {
		info(
			`Pull request is not authored by ${config.pullRequestAuthor}, ignoring.`,
		);
		return;
	}

	if (!pullRequest.title.startsWith(config.pullRequestPrefix)) {
		info(
			`Pull request title does not start with "${config.pullRequestPrefix}", ignoring.`,
		);
		return;
	}

	/*************************************/

	const allowedFiles = Object.keys(config.expectedChanges);
	const expectedFilesChanges = allowedFiles.length;

	/*************************************/

	// Although part of this case would be caught implicitly by the following checks
	// checking it at this stage means that we can fail early and avoid
	// calling the listFiles endpoint
	// This check does also catch the case when not as many changes as expected
	// are made
	if (pullRequest.changed_files !== expectedFilesChanges) {
		throw new Error(
			`Pull request changes ${pullRequest.changed_files} ${pluralise({
				number: pullRequest.changed_files,
				singular: 'file',
				plural: 'files',
			})}. Expected to see changes to all of the following files: ${allowedFiles.join(
				', ',
			)}`,
		);
	}

	/*************************************/

	const { data: files } = await octokit.pulls.listFiles(prData);

	for (const file of files) {
		if (!allowedFiles.includes(file.filename)) {
			throw new Error(
				`Disallowed file (${
					file.filename
				}) changed. Allowed files are: ${allowedFiles.join(', ')}`,
			);
		}

		const expectedChanges = config.expectedChanges[file.filename];

		if (file.changes !== expectedChanges.length) {
			throw new Error(
				`${file.changes} ${pluralise({
					number: file.changes,
					singular: 'change',
					plural: 'changes',
				})} in file: ${file.filename}. Expected ${
					expectedChanges.length
				} ${pluralise({
					number: expectedChanges.length,
					singular: 'change',
					plural: 'changes',
				})}`,
			);
		}

		if (file.patch) {
			for (const change of expectedChanges) {
				if (!file.patch.includes(change)) {
					throw new Error(
						`Expected to see the following string in diff for ${file.filename}: ${change}\n\nPR Diff: ${file.patch}`,
					);
				}
			}
		}
	}
};
