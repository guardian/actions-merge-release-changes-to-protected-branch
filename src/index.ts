import { debug, info, setFailed } from '@actions/core';
import { context } from '@actions/github';
import { mergePullRequest } from './actions/merge-pull-request';
import { raisePullRequest } from './actions/raise-pull-request';
import { shouldMergePullRequest } from './actions/should-merge-pull-request';
import { validatePullRequest } from './actions/validate-pull-request';
import { getConfig } from './config';
import { octokit } from './lib/github';
import { name } from './lib/pkg';
import type {
	PullRequestEvent,
	PushEvent,
} from '@octokit/webhooks-definitions/schema';

export type PRData = { owner: string; repo: string; pull_number: number };

async function run(): Promise<void> {
	try {
		info(`Running ${name}`);

		debug(`Event name: ${context.eventName}`);
		debug(`Action type: ${context.payload.action ?? 'Unknown'}`);

		const config = getConfig();

		switch (context.eventName) {
			case 'push': {
				const payload = context.payload as PushEvent;
				await raisePullRequest({ payload, config });
				break;
			}

			case 'pull_request': {
				const payload = context.payload as PullRequestEvent;
				const prData: PRData = {
					owner: payload.repository.owner.login,
					repo: payload.repository.name,
					pull_number: payload.pull_request.number,
				};

				// PR information isn't necessarily up to date in webhook payload
				// Get PR from the API to be sure
				const { data: pullRequest } = await octokit.rest.pulls.get(
					prData,
				);
				debug(`Pull request: ${payload.pull_request.number}`);

				if (shouldMergePullRequest({ pullRequest, config })) {
					await validatePullRequest({ pullRequest, prData, config });
					await mergePullRequest({ pullRequest, prData, payload });
				}

				break;
			}

			default:
				throw new Error(`Unknown eventName: ${context.eventName}`);
		}
	} catch (error) {
		if (error instanceof Error) {
			setFailed(error.message);
		} else {
			throw error;
		}
	}
}

void run();
