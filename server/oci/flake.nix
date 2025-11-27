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

      # Velocity Proxy from nixpkgs (3.4.0-unstable-2025-11-09)
      velocity = pkgs.velocity;

      # Paper Server from nixpkgs (1.21.10-91)
      paperServer = pkgs.papermc;
    in {
      default = velocity;
      inherit velocity paperServer;
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
