export const leaderboardColumnOrderDefault = [
	"position",
	"tire",
	"info",
	"gap",
	"laptime",
	"sectors",
	"speed",
	"gear",
	"throttle",
	"brake",
	"rpm",
	"battery-deploy",
	"overtake-mode",
	"straight-mode",
	"boost",
	"drs",
	"extra",
] as const;

export type LeaderboardColumnId = (typeof leaderboardColumnOrderDefault)[number];

export type LeaderboardColumn = {
	id: LeaderboardColumnId;
	label: string;
	visible: boolean;
	width: string;
};

export const leaderboardColumnsDefault: LeaderboardColumn[] = [
	{ id: "position", label: "Position", visible: true, width: "5.5rem" },
	{ id: "tire", label: "Tire", visible: true, width: "5.5rem" },
	{ id: "info", label: "Info", visible: true, width: "4rem" },
	{ id: "gap", label: "Gap", visible: true, width: "5rem" },
	{ id: "laptime", label: "Lap Time", visible: true, width: "5.5rem" },
	{ id: "sectors", label: "Sectors", visible: true, width: "auto" },
	{ id: "speed", label: "Speed", visible: true, width: "4.5rem" },
	{ id: "gear", label: "Gear", visible: true, width: "3.5rem" },
	{ id: "throttle", label: "Throttle", visible: true, width: "5.5rem" },
	{ id: "brake", label: "Brake", visible: true, width: "4.5rem" },
	{ id: "rpm", label: "RPM", visible: false, width: "5rem" },
	{ id: "battery-deploy", label: "Battery (raw)", visible: true, width: "5rem" },
	{ id: "overtake-mode", label: "Overtake (raw)", visible: true, width: "5rem" },
	{ id: "straight-mode", label: "Straight (raw)", visible: true, width: "5rem" },
	{ id: "boost", label: "Boost (raw)", visible: true, width: "5rem" },
	{ id: "drs", label: "DRS", visible: false, width: "3.5rem" },
	{ id: "extra", label: "Extra Channels", visible: true, width: "16rem" },
];
