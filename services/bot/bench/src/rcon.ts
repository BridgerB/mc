/**
 * RCON helper — sends commands to the bench server.
 * In 1.21.11, /give via bot.chat() doesn't send set_slot back to the same client.
 * RCON bypasses this by sending commands as the server console.
 */

import { execSync } from "node:child_process";

const RCON_PORT = process.env.BENCH_RCON_PORT ?? "23625";
const RCON_PASS = process.env.BENCH_RCON_PASS ?? "bench-rcon-pass";

const MCRCON = "/nix/store/szc9sxz4d1hx1ixyakcjskl2crmi0bql-mcrcon-0.7.2/bin/mcrcon";

export const rcon = (command: string): string => {
	try {
		return execSync(
			`${MCRCON} -H localhost -P ${RCON_PORT} -p ${RCON_PASS} "${command}"`,
			{ encoding: "utf8", timeout: 5000 },
		).trim();
	} catch {
		return "";
	}
};
