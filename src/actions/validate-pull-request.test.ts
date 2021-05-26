import { _ } from './validate-pull-request';
import type { Config } from '../config';
import type { octokit } from '../lib/github';
import type { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';

type Files = GetResponseDataTypeFromEndpointMethod<
	typeof octokit.rest.pulls.listFiles
>;

describe('The validateFiles function', () => {
	const config = {
		expectedChanges: {
			'package.json': ['-  "version": "', '+  "version": "'],
			'package-lock.json': ['-  "version": "'],
		},
	} as unknown as Config;

	it('should throw an error if the file changed is not one of those allowed', () => {
		const files = [{ filename: 'test.json' }] as Files;
		expect(() => _.validateFiles({ config, files })).toThrowError(
			'Disallowed file (test.json) changed. Allowed files are: package.json, package-lock.json',
		);
	});

	describe('should throw an error if the number of changes is not the same as that expected', () => {
		it('with correct pluralisation for a single change and multiple expected changes', () => {
			const files = [{ filename: 'package.json', changes: 1 }] as Files;
			expect(() => _.validateFiles({ config, files })).toThrowError(
				'1 change in file: package.json. Expected 2 changes',
			);
		});

		it('with correct pluralisation for multiple changes', () => {
			const files = [
				{ filename: 'package-lock.json', changes: 2 },
			] as Files;
			expect(() => _.validateFiles({ config, files })).toThrowError(
				'2 changes in file: package-lock.json. Expected 1 change',
			);
		});
	});

	it('should throw an error if an expected change is not found in the file patch', () => {
		const files = [
			{
				filename: 'package.json',
				changes: 2,
				patch: '-  "version": "',
			},
		] as Files;
		expect(() => _.validateFiles({ config, files })).toThrowError(
			'Expected to see the following string in diff for package.json: +  "version": "\n\nPR Diff: -  "version": "',
		);
	});

	it('should throw an error if the issue is not the first file in the array', () => {
		const files = [
			{
				filename: 'package.json',
				changes: 2,
				patch: '-  "version": " +  "version": "',
			},
			{ filename: 'package-lock.json', changes: 2 },
		] as Files;
		expect(() => _.validateFiles({ config, files })).toThrowError(
			'2 changes in file: package-lock.json. Expected 1 change',
		);
	});

	it("shouldn't throw if all the files are okay", () => {
		const files = [
			{
				filename: 'package.json',
				changes: 2,
				patch: '-  "version": " +  "version": "',
			},
			{
				filename: 'package-lock.json',
				changes: 1,
				patch: '-  "version": "',
			},
		] as Files;
		expect(() => _.validateFiles({ config, files })).not.toThrowError();
	});

	it('should allow any changes if the allowed value is *', () => {
		const config = {
			expectedChanges: {
				'package.json': ['-  "version": "', '+  "version": "'],
				'package-lock.json': '*',
			},
		} as unknown as Config;

		const files = [
			{
				filename: 'package.json',
				changes: 2,
				patch: '-  "version": " +  "version": "',
			},
			{
				filename: 'package-lock.json',
				changes: 4,
				patch: 'patch',
			},
		] as Files;
		expect(() => _.validateFiles({ config, files })).not.toThrowError();
	});

	it('should still error for unexpected file changes if value is *', () => {
		const config = {
			expectedChanges: {
				'package-lock.json': '*',
			},
		} as unknown as Config;

		const files = [
			{
				filename: 'package.json',
				changes: 2,
				patch: '-  "version": " +  "version": "',
			},
			{
				filename: 'package-lock.json',
				changes: 4,
				patch: 'patch',
			},
		] as Files;
		expect(() => _.validateFiles({ config, files })).toThrowError(
			'Disallowed file (package.json) changed. Allowed files are: package-lock.json',
		);
	});
});
