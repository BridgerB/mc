#!/usr/bin/env -S deno run --allow-run --allow-env --allow-read

// Deploy one of the OCI Minecraft NixOS configs to a server.
//   ./deploy.ts <public-ip> <velocity|steve>
//
// Shared files (flake.nix, common.nix, config.nix) live at this directory's
// root and are imported by the per-target configuration.nix in velocity/ and
// steve/. The whole tree is mirrored to /etc/nixos and built with
// `nixos-rebuild switch --flake .#<target>`.

const publicIp = Deno.args[0];
const target = Deno.args[1];

const TARGETS = ["velocity", "steve"] as const;
type Target = (typeof TARGETS)[number];

if (!publicIp || !TARGETS.includes(target as Target)) {
  console.error("Usage: ./deploy.ts <public-ip> <velocity|steve>");
  Deno.exit(1);
}

// Files copied for every target (live at the oci/ root, imported by subdirs).
const sharedFiles = ["flake.nix", "flake.lock", "common.nix", "config.nix"];

// Per-target files (relative to oci/). Directories are copied recursively.
const targetFiles: Record<Target, string[]> = {
  velocity: [
    "velocity/configuration.nix",
    "velocity/velocity.toml",
    "velocity/portals",
    "../plugins/advanced-portals",
  ],
  steve: ["steve/configuration.nix"],
};

async function run(cmd: string, args: string[]): Promise<void> {
  console.log(`Running: ${cmd} ${args.join(" ")}`);
  const { success } = await new Deno.Command(cmd, {
    args,
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (!success) throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
}

const ssh = (command: string) =>
  run("ssh", ["-o", "StrictHostKeyChecking=no", `root@${publicIp}`, command]);

const scp = (src: string, dest: string, recursive = false) =>
  run("scp", [
    ...(recursive ? ["-r"] : []),
    "-o",
    "StrictHostKeyChecking=no",
    src,
    `root@${publicIp}:/etc/nixos/${dest}`,
  ]);

async function deploy() {
  const t = target as Target;
  console.log(`Deploying '${t}' to ${publicIp}...`);

  console.log("Waiting for SSH to be ready...");
  await new Promise((r) => setTimeout(r, 10000));

  // Generate fresh hardware config on the server (not copied from here).
  console.log("\nGenerating fresh hardware configuration...");
  await ssh("rm -f /etc/nixos/hardware-configuration.nix && nixos-generate-config");

  // Ensure target subdirs exist on the server.
  await ssh(`mkdir -p /etc/nixos/${t} /etc/nixos/plugins`);

  console.log("\nCopying shared files...");
  for (const f of sharedFiles) await scp(f, f);

  console.log(`\nCopying ${t} files...`);
  for (const f of targetFiles[t]) {
    // Strip leading ../ so plugins land under /etc/nixos/plugins/...
    const dest = f.replace(/^\.\.\//, "");
    const recursive = !f.endsWith(".nix") && !f.endsWith(".toml");
    await scp(f, dest, recursive);
  }

  console.log("\nRunning nixos-rebuild switch...");
  await ssh(`cd /etc/nixos && nixos-rebuild switch --flake .#${t}`);

  console.log("\n✅ Deployment complete!");
  console.log(`\nVerify with:`);
  const unit = t === "steve" ? "minecraft-server" : "velocity-proxy";
  console.log(`  ssh root@${publicIp} 'systemctl status ${unit}'`);
}

deploy().catch((error) => {
  console.error("Deployment failed:", error.message);
  Deno.exit(1);
});
