import { debug } from '@actions/core';
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

interface ValidateFileProps {
	files: GetResponseDataTypeFromEndpointMethod<
		typeof octokit.pulls.listFiles
	>;
	config: Config;
}

export const validatePullRequest = async ({
	pullRequest,
	config,
	prData,
}: Props): Promise<void> => {
	debug('validatePullRequest');

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

	validateFiles({ files, config });
};

const validateFiles = ({ files, config }: ValidateFileProps): void => {
	const allowedFiles = Object.keys(config.expectedChanges);

	for (const file of files) {
		if (!allowedFiles.includes(file.filename)) {
			throw new Error(
				`Disallowed file (${
					file.filename
				}) changed. Allowed files are: ${allowedFiles.join(', ')}`,
			);
		}

		const expectedChanges = config.expectedChanges[file.filename];

		if (expectedChanges === '*') {
			continue;
		}

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

		if (typeof file.patch !== 'undefined') {
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

export const _ = { validateFiles };
