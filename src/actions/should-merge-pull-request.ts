import { info } from '@actions/core';
import type { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';
import type { Config } from '../config';
import type { octokit } from '../lib/github';

interface Props {
	pullRequest: GetResponseDataTypeFromEndpointMethod<
		typeof octokit.rest.pulls.get
	>;
	config: Config;
}

export const shouldMergePullRequest = ({
	pullRequest,
	config,
}: Props): boolean => {
	info('Checking pull request is valid');

	if (
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- keeping code as it was before upgrading eslint
		!pullRequest.user ||
		pullRequest.user.login !== config.pullRequestAuthor
	) {
		info(
			`Pull request is not authored by ${config.pullRequestAuthor}, ignoring.`,
		);
		return false;
	}

	if (!pullRequest.title.startsWith(config.pullRequestPrefix)) {
		info(
			`Pull request title does not start with "${config.pullRequestPrefix}", ignoring.`,
		);
		return false;
	}

	return true;
};
