/* eslint-disable import/order -- some rules are in conflict, but it's fine */
import type { PackageJson } from 'type-fest';

export const name =
	(require('../../package.json') as PackageJson).name ??
	"Couldn't find package name?";
