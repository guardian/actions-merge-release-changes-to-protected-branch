import { shouldMergePullRequest } from './should-merge-pull-request';
import type { Config } from '../config';
import type { octokit } from '../lib/github';
import type { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';

type PullRequest = GetResponseDataTypeFromEndpointMethod<
	typeof octokit.pulls.get
>;

describe('The shouldMergePullRequest', () => {
	it('returns false if the PR has no author', () => {
		const pullRequest = {} as unknown as PullRequest;
		const config = {} as Config;

		expect(shouldMergePullRequest({ pullRequest, config })).toBe(false);
	});

	it('returns false if the PR author is not the one expected', () => {
		const pullRequest = {
			user: { login: 'user1' },
		} as unknown as PullRequest;
		const config = { pullRequestAuthor: 'user2' } as Config;

		expect(shouldMergePullRequest({ pullRequest, config })).toBe(false);
	});

	it("returns false if the PR title doesn't start with the expected prefix", () => {
		const pullRequest = {
			user: { login: 'user1' },
			title: 'title',
		} as unknown as PullRequest;
		const config = {
			pullRequestAuthor: 'user1',
			pullRequestPrefix: 'release:',
		} as Config;

		expect(shouldMergePullRequest({ pullRequest, config })).toBe(false);
	});

	it('returns true if the PR author matches and the title starts with the expected prefix', () => {
		const pullRequest = {
			user: { login: 'user1' },
			title: 'release: title',
		} as unknown as PullRequest;
		const config = {
			pullRequestAuthor: 'user1',
			pullRequestPrefix: 'release:',
		} as Config;

		expect(shouldMergePullRequest({ pullRequest, config })).toBe(true);
	});
});
