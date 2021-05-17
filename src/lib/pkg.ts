import type { PackageJson } from 'type-fest';

export const name =
	(require('../../package.json') as PackageJson).name ??
	"Couldn't find package name?";
