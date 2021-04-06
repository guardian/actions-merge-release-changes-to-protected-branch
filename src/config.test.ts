import { getInput } from '@actions/core';
import { _ } from './config';

jest.mock('@actions/core');

const mockGetInput = getInput as jest.MockedFunction<typeof getInput>;

describe('The getConfigValueOrDefault function', () => {
	beforeEach(() => {
		mockGetInput.mockClear();
	});

	afterAll(() => {
		mockGetInput.mockClear();
	});

	it('returns the value if it is present', () => {
		mockGetInput.mockImplementationOnce(() => 'test');
		expect(_.getConfigValueOrDefault('test', 'default')).toBe('test');
	});

	it('returns the default value if no value is present', () => {
		expect(_.getConfigValueOrDefault('test', 'default')).toBe('default');
	});
});

describe('The parseAdditionalChanges function', () => {
	it('returns the parsed string if value is valid', () => {
		expect(_.parseAdditionalChanges('{}')).toEqual({});
	});

	it('returns the parsed string if value is valid and not an empty object', () => {
		expect(
			_.parseAdditionalChanges('{"src/test.ts": ["one", "two"]}'),
		).toEqual({ 'src/test.ts': ['one', 'two'] });
	});

	it('throws an error if invalid JSON is provided', () => {
		expect(() => {
			_.parseAdditionalChanges('{');
		}).toThrowError('Invalid JSON provided for additional-changes input');
	});

	it('throws an error if the value is not an object', () => {
		expect(() => {
			_.parseAdditionalChanges('"test"');
		}).toThrowError('additional-changes value must be an object');
		expect(() => {
			_.parseAdditionalChanges('[]');
		}).toThrowError('additional-changes value must be an object');
		expect(() => {
			_.parseAdditionalChanges('1');
		}).toThrowError('additional-changes value must be an object');
		expect(() => {
			_.parseAdditionalChanges('true');
		}).toThrowError('additional-changes value must be an object');
		expect(() => {
			_.parseAdditionalChanges('null');
		}).toThrowError('additional-changes value must be an object');
	});

	it('throws an error if one of the values is not an array or "*"', () => {
		expect(() => {
			_.parseAdditionalChanges('{"key": "value"}');
		}).toThrowError('values in additional-changes object must be arrays');
	});

	it('does not throw an error if the value is "*"', () => {
		expect(() => {
			_.parseAdditionalChanges('{"key": "*"}');
		}).not.toThrowError();
	});
});

describe('The getFileChangesConfig function', () => {
	beforeEach(() => {
		mockGetInput.mockClear();
	});

	afterAll(() => {
		mockGetInput.mockClear();
	});

	it('throws an error if an invalid package-manager value is provided', () => {
		mockGetInput.mockImplementationOnce(() => 'maven');
		expect(_.getFileChangesConfig).toThrowError(
			'Invalid package-manager value (maven) provided. Allowed values are: npm, yarn',
		);
	});

	it('merges package manager and additional changes', () => {
		mockGetInput.mockImplementation((name: string): string => {
			return name === 'package-manager'
				? 'npm'
				: '{"README.md": ["one"]}';
		});
		expect(_.getFileChangesConfig()).toEqual({
			expectedChanges: {
				'package.json': ['-  "version": "', '+  "version": "'],
				'package-lock.json': ['-  "version": "', '+  "version": "'],
				'README.md': ['one'],
			},
		});
	});
});
