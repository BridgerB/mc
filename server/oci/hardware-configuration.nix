# Placeholder hardware configuration for local builds
# The actual hardware-configuration.nix is generated on the OCI server during deployment
# This file is NOT deployed - deploy.ts generates fresh hardware config on the server
{
  config,
  lib,
  pkgs,
  modulesPath,
  ...
}: {
  imports = [];

  # Minimal placeholder configuration
  boot.loader.grub.device = "nodev";
  fileSystems."/" = {
    device = "/dev/disk/by-label/nixos";
    fsType = "ext4";
  };

  nixpkgs.hostPlatform = "aarch64-linux";
}
