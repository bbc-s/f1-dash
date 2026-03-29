export type DriverStanding = {
	position: number;
	points: number;
	wins: number;
	driverId: string;
	code?: string;
	givenName: string;
	familyName: string;
	constructorName: string;
};

export type ConstructorStanding = {
	position: number;
	points: number;
	wins: number;
	constructorId: string;
	name: string;
};

export type StandingsResponse = {
	season: string;
	round: string;
	drivers: DriverStanding[];
	constructors: ConstructorStanding[];
	source: string;
};
