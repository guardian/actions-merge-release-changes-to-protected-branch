import { debug, info } from '@actions/core';
import { octokit } from '../lib/github';
import { name } from '../lib/pkg';
import { getMergeMethod } from './get-merge-method';
import type { PRData } from '../index';
import type { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';
import type { PullRequestEvent } from '@octokit/webhooks-definitions/schema';

interface Props {
	pullRequest: GetResponseDataTypeFromEndpointMethod<
		typeof octokit.rest.pulls.get
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

	await octokit.rest.pulls.createReview({
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

	await octokit.rest.pulls.merge({
		...prData,
		merge_method: getMergeMethod(payload.pull_request.base.repo),
	});
};
