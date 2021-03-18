import { pluralise } from './pluralise';

describe('The pluralise function', () => {
	it('returns the singlur value if the number is 1', () => {
		expect(
			pluralise({
				number: 1,
				singular: 'singular',
				plural: 'plural',
			}),
		).toBe('singular');
	});

	it('returns the plural value if the number is greater than 1', () => {
		expect(
			pluralise({
				number: 2,
				singular: 'singular',
				plural: 'plural',
			}),
		).toBe('plural');
	});

	it('returns the plural value if the number is 0', () => {
		expect(
			pluralise({
				number: 0,
				singular: 'singular',
				plural: 'plural',
			}),
		).toBe('plural');
	});
});
