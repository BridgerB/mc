{
  description = "NixOS Minecraft Server for Oracle Cloud Infrastructure (OCI) ARM";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = {
    self,
    nixpkgs,
  }: let
    # Support both x86_64 (for local builds) and aarch64 (for OCI ARM)
    forAllSystems = nixpkgs.lib.genAttrs ["x86_64-linux" "aarch64-linux"];
  in {
    # Packages available on both systems
    packages = forAllSystems (system: let
      pkgs = import nixpkgs {
        inherit system;
        config.allowUnfree = true;
      };

      # Vanilla Minecraft Server 1.21.4
      # Downloaded directly from Mojang's official distribution
      minecraftServer = pkgs.fetchurl {
        url = "https://piston-data.mojang.com/v1/objects/95495a7f485eedd84ce928cef5e223b757d2f764/server.jar";
        sha256 = "sha256-tKU1vHXP/FqmG/TYNyzg5k4kYfZ0PJXmHHSvZVb1Hso=";
      };
    in {
      default = minecraftServer;
      minecraft-server = minecraftServer;
    });

    # NixOS system configuration for OCI ARM deployment
    nixosConfigurations.minecraft = nixpkgs.lib.nixosSystem {
      system = "aarch64-linux";
      modules = [
        ./configuration.nix
        ./hardware-configuration.nix
      ];
    };
  };
}
