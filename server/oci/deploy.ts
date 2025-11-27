#!/usr/bin/env -S deno run --allow-run --allow-env --allow-read

const publicIp = Deno.args[0];

if (!publicIp) {
  console.error("Usage: ./deploy.ts <public-ip>");
  Deno.exit(1);
}

async function runCommand(cmd: string, args: string[]): Promise<void> {
  console.log(`Running: ${cmd} ${args.join(" ")}`);
  const command = new Deno.Command(cmd, {
    args,
    stdout: "inherit",
    stderr: "inherit",
  });

  const { success } = await command.output();

  if (!success) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
  }
}

async function deploy() {
  console.log(`Deploying to ${publicIp}...`);

  // Wait a bit for SSH to be ready
  console.log("Waiting for SSH to be ready...");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Generate fresh hardware config on server
  console.log("\nGenerating fresh hardware configuration...");
  await runCommand("ssh", [
    "-o",
    "StrictHostKeyChecking=no",
    `root@${publicIp}`,
    "rm -f /etc/nixos/hardware-configuration.nix && nixos-generate-config",
  ]);

  // Copy configuration files (NOT hardware-configuration.nix)
  console.log("\nCopying configuration files...");
  const files = ["flake.nix", "flake.lock", "configuration.nix"];

  for (const file of files) {
    await runCommand("scp", [
      "-o",
      "StrictHostKeyChecking=no",
      file,
      `root@${publicIp}:/etc/nixos/${file}`,
    ]);
  }

  // Run nixos-rebuild
  console.log("\nRunning nixos-rebuild switch...");
  await runCommand("ssh", [
    "-o",
    "StrictHostKeyChecking=no",
    `root@${publicIp}`,
    "cd /etc/nixos && nixos-rebuild switch --flake .#minecraft",
  ]);

  console.log("\n✅ Deployment complete!");
  console.log(`\nVerify Minecraft server with:`);
  console.log(`  ssh root@${publicIp} 'systemctl status minecraft-server'`);
}

deploy().catch((error) => {
  console.error("Deployment failed:", error.message);
  Deno.exit(1);
});
