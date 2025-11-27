#!/usr/bin/env -S deno run --allow-run --allow-env --allow-read

const config = {
  displayName: "minecraft-server",
  availabilityDomain: "ndHF:PHX-AD-1",
  compartmentId:
    "ocid1.tenancy.oc1..aaaaaaaaxce66srgd3kttidixoktcxyqdbmc5spi4vnhktccnj5uvyeyuddq",
  shape: "VM.Standard.A1.Flex",
  ocpus: 4,
  memoryInGBs: 24,
  imageId:
    "ocid1.image.oc1.phx.aaaaaaaagslm6zxz4ab6pivcatx6wpvl3hkid6ywhsfx4mvlckqmbceyffoa",
  subnetId:
    "ocid1.subnet.oc1.phx.aaaaaaaas5lnssbgrqqfzybiypmm3rvqzdqydej35pby6l3lt5ij5eqideba",
  sshKeyFile: `${Deno.env.get("HOME")}/.ssh/id_ed25519.pub`,
  bootVolumeSizeInGBs: 100,
};

async function runCommand(args: string[]): Promise<string> {
  const command = new Deno.Command("oci", {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout, stderr, success } = await command.output();

  if (!success) {
    const errorText = new TextDecoder().decode(stderr);
    throw new Error(`Command failed: ${errorText}`);
  }

  return new TextDecoder().decode(stdout);
}

async function launchInstance() {
  console.log("Launching OCI instance...");

  const launchArgs = [
    "compute",
    "instance",
    "launch",
    "--display-name",
    config.displayName,
    "--availability-domain",
    config.availabilityDomain,
    "--compartment-id",
    config.compartmentId,
    "--shape",
    config.shape,
    "--shape-config",
    JSON.stringify({ ocpus: config.ocpus, memoryInGBs: config.memoryInGBs }),
    "--image-id",
    config.imageId,
    "--subnet-id",
    config.subnetId,
    "--assign-public-ip",
    "true",
    "--ssh-authorized-keys-file",
    config.sshKeyFile,
    "--boot-volume-size-in-gbs",
    config.bootVolumeSizeInGBs.toString(),
    "--auth",
    "security_token",
  ];

  try {
    const output = await runCommand(launchArgs);
    const data = JSON.parse(output);

    const instanceId = data.data.id;
    console.log(`Instance created: ${instanceId}`);

    // Wait for RUNNING state
    console.log("Waiting for instance to reach RUNNING state...");
    while (true) {
      const statusOutput = await runCommand([
        "compute",
        "instance",
        "get",
        "--instance-id",
        instanceId,
        "--auth",
        "security_token",
      ]);
      const statusData = JSON.parse(statusOutput);
      const state = statusData.data["lifecycle-state"];

      console.log(`State: ${state}`);

      if (state === "RUNNING") {
        // Get public IP
        const vnicOutput = await runCommand([
          "compute",
          "instance",
          "list-vnics",
          "--instance-id",
          instanceId,
          "--auth",
          "security_token",
        ]);
        const vnicData = JSON.parse(vnicOutput);
        const publicIp = vnicData.data[0]["public-ip"];

        console.log(`\nInstance is RUNNING!`);
        console.log(`Instance ID: ${instanceId}`);
        console.log(`Public IP: ${publicIp}`);
        console.log(`\nSSH command: ssh root@${publicIp}`);
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  } catch (error) {
    console.error("Error launching instance:", error.message);
    Deno.exit(1);
  }
}

launchInstance();
