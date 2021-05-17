import { getMergeMethod } from './get-merge-method';
import type { Repository } from '@octokit/webhooks-definitions/schema';

describe('The getMergeMethod function', () => {
	it('returns merge if merge commits are allowed', () => {
		expect(
			getMergeMethod({
				allow_merge_commit: true,
				allow_rebase_merge: true,
				allow_squash_merge: true,
			} as unknown as Repository),
		).toBe('merge');
	});

	it("returns squash if squash commits are allowed and merge commits aren't", () => {
		expect(
			getMergeMethod({
				allow_merge_commit: false,
				allow_rebase_merge: true,
				allow_squash_merge: true,
			} as unknown as Repository),
		).toBe('squash');
	});

	it('returns rebase if rebase commits are allowed and merge and squash are not', () => {
		expect(
			getMergeMethod({
				allow_merge_commit: false,
				allow_rebase_merge: true,
				allow_squash_merge: false,
			} as unknown as Repository),
		).toBe('rebase');
	});

	it('returns merge if no methods are allowed', () => {
		expect(
			getMergeMethod({
				allow_merge_commit: false,
				allow_rebase_merge: false,
				allow_squash_merge: false,
			} as unknown as Repository),
		).toBe('merge');
	});
});
