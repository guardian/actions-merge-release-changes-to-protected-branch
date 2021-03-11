import { setFailed, info } from '@actions/core';
import { getConfig } from './config';
import { decideAndTriggerAction } from './action';

async function run(): Promise<void> {
	try {
		info(
			'Running @guardian/actions-merge-release-changes-to-protected-branch',
		);
		const config = getConfig();
		await decideAndTriggerAction(config);
	} catch (error) {
		if (error instanceof Error) {
			setFailed(error.message);
		} else {
			throw error;
		}
	}
}

void run();
