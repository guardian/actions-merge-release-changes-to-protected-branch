import { setFailed, info, debug } from '@actions/core';
import { getConfig } from './config';
import { raisePullRequest } from './actions/raise-pull-request';
import { resolve } from 'path';
import { context } from '@actions/github';
import {
	PullRequestEvent,
	PushEvent,
} from '@octokit/webhooks-definitions/schema';
import { mergePullRequest } from './actions/merge-pull-request';

async function run(): Promise<void> {
	try {
		info(`Running ${require(resolve(process.cwd(), 'package.json')).name}`);
		const config = getConfig();

		const eventName = context.eventName;
		debug(`Event name: ${eventName}`);

		const payload = context.payload;
		debug(`Action type: ${payload.action ?? 'Unknown'}`);

		switch (eventName) {
			case 'push':
				return raisePullRequest(payload as PushEvent, config);
			case 'pull_request':
				return mergePullRequest(payload as PullRequestEvent, config);
			default:
				throw new Error(`Unknown eventName: ${eventName}`);
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
