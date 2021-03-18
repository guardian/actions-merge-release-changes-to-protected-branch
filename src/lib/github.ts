import { getInput } from '@actions/core';
import { getOctokit } from '@actions/github';

export const token = getInput('github-token', { required: true });
export const octokit = getOctokit(token);
