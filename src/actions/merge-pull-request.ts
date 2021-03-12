import { debug, info } from '@actions/core';
import type { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';
import type {
	PullRequestEvent,
	Repository,
} from '@octokit/webhooks-definitions/schema';
import type { PRData } from '../index';
import { octokit } from '../lib/github';
import { name } from '../lib/pkg';

interface Props {
	pullRequest: GetResponseDataTypeFromEndpointMethod<
		typeof octokit.pulls.get
	>;
	prData: PRData;
	payload: PullRequestEvent;
}

const getMergeMethod = (
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

export const mergePullRequest = async ({
	pullRequest,
	prData,
	payload,
}: Props): Promise<void> => {
	debug('mergePullRequest');

	/*************************************/

	await octokit.pulls.createReview({
		...prData,
		event: 'APPROVE',
		body: `Approved automatically by ${name}`,
	});

	/*************************************/

	info(`Checking if PR can be merged`);

	if (!pullRequest.mergeable) {
		info(`Pull request can not be merged, exiting.`);
		return;
	}

	/*************************************/

	info(`Merging pull request`);

	await octokit.pulls.merge({
		...prData,
		merge_method: getMergeMethod(payload.pull_request.base.repo),
	});
};
