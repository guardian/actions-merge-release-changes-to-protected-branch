import { debug, info } from '@actions/core';
import type { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';
import type { PullRequestEvent } from '@octokit/webhooks-definitions/schema';
import type { PRData } from '../index';
import { octokit } from '../lib/github';
import { name } from '../lib/pkg';
import { getMergeMethod } from './get-merge-method';

interface Props {
	pullRequest: GetResponseDataTypeFromEndpointMethod<
		typeof octokit.pulls.get
	>;
	prData: PRData;
	payload: PullRequestEvent;
}

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
