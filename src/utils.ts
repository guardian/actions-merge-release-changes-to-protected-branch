export const maybePluralise = ({
	number,
	singular,
	plural,
}: {
	number: number;
	singular: string;
	plural: string;
}): string => {
	return number === 1 ? singular : plural;
};
