import type { Repository } from '@octokit/webhooks-types';

export const getMergeMethod = (
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
