/**
 * Welcome to the most scuffed time/date conversion.
 *
 * We assume the offset has this patter: HH:mm:ss
 *
 * We also assume that the utc date provided does not have a Z to indicate utc, because why not F1
 *
 * We extract the h m s from our string and parse to ints/numbers
 * We individually update our original date with hours, minutes and seconds.
 * *
 * @param utc
 * @param offset
 * @returns ISO-8601 string
 */
export const toTrackTime = (utc: string, offset: string): string => {
	const date = new Date(utc);
	if (Number.isNaN(date.getTime())) {
		return new Date().toISOString();
	}

	const trimmed = (offset ?? "").trim();
	const sign = trimmed.startsWith("-") ? -1 : 1;
	const parts = trimmed.replace(/^[+-]/, "").split(":");
	const [rawH = "0", rawM = "0", rawS = "0"] = parts;
	const hours = Number.parseInt(rawH, 10);
	const minutes = Number.parseInt(rawM, 10);
	const seconds = Number.parseInt(rawS, 10);

	if ([hours, minutes, seconds].some((value) => Number.isNaN(value))) {
		return date.toISOString();
	}

	date.setUTCHours(date.getUTCHours() + sign * hours);
	date.setUTCMinutes(date.getUTCMinutes() + sign * minutes);
	date.setUTCSeconds(date.getUTCSeconds() + sign * seconds);

	return date.toISOString();
};
