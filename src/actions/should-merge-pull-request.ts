import { info } from '@actions/core';
import { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';
import { Config } from '../config';
import { octokit } from '../lib/github';

interface Props {
	pullRequest: GetResponseDataTypeFromEndpointMethod<
		typeof octokit.pulls.get
	>;
	config: Config;
}

export const shouldMergePullRequest = ({ pullRequest, config }: Props) => {
	info('Checking pull request is valid');

	if (
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
