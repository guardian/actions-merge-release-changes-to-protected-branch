import { maybePluralise } from './utils';

describe('The maybePluralise function', () => {
	it('returns the singlur value if the number is 1', () => {
		expect(
			maybePluralise({
				number: 1,
				singular: 'singular',
				plural: 'plural',
			}),
		).toBe('singular');
	});

	it('returns the plural value if the number is greater than 1', () => {
		expect(
			maybePluralise({
				number: 2,
				singular: 'singular',
				plural: 'plural',
			}),
		).toBe('plural');
	});

	it('returns the plural value if the number is 0', () => {
		expect(
			maybePluralise({
				number: 0,
				singular: 'singular',
				plural: 'plural',
			}),
		).toBe('plural');
	});
});
