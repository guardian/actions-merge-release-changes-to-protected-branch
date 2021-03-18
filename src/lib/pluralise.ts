export const pluralise = ({
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
