{
  description = "NixOS Minecraft Server for Oracle Cloud Infrastructure (OCI) ARM";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    advanced-portals-src = {
      url = "github:sekwah41/Advanced-Portals/main";
      flake = false;
    };
  };

  outputs = {
    self,
    nixpkgs,
    advanced-portals-src,
  }: let
    forAllSystems = nixpkgs.lib.genAttrs ["x86_64-linux" "aarch64-linux"];

    # Advanced Portals plugin build
    mkAdvancedPortals = pkgs:
      pkgs.stdenv.mkDerivation {
        pname = "advanced-portals";
        version = "2.6.0-SNAPSHOT";
        src = advanced-portals-src;

        nativeBuildInputs = with pkgs; [jdk17 gradle.unwrapped];
        dontUseGradleSetupHook = true;

        patchPhase = ''
          sed -i "/id 'org.jetbrains.gradle.plugin.idea-ext'/d" build.gradle
          sed -i '/^idea {$/,/^}$/d' build.gradle
        '';

        buildPhase = ''
          export GRADLE_USER_HOME=$PWD/.gradle
          mkdir -p spigot/build/generated/resources
          touch spigot/build/generated/resources/permissions.yml
          gradle :spigot:build -x test -x compilePermissionsGen -x generatePermissionsYaml --no-daemon --refresh-dependencies
        '';

        installPhase = ''
          mkdir -p $out/lib
          cp spigot/build/libs/Advanced-Portals-Spigot-*.jar $out/lib/advanced-portals.jar
        '';

        outputHashMode = "recursive";
        outputHashAlgo = "sha256";
        outputHash = "sha256-lbAn45xhv1CCt2x8EGHNPSDVagQlv9biqKfLipMQHy4=";
      };

    # Advanced Portals config generator
    mkPortalsConfig = {
      enableProxySupport ? true,
      defaultTriggerBlock ? "NETHER_PORTAL",
      selectorMaterial ? "IRON_AXE",
      portalProtection ? true,
      portalProtectionArea ? 5,
      ...
    }: ''
      # Advanced Portals Configuration
      enableProxySupport: ${
        if enableProxySupport
        then "true"
        else "false"
      }
      defaultTriggerBlock: ${defaultTriggerBlock}
      selectorMaterial: ${selectorMaterial}
      portalProtection: ${
        if portalProtection
        then "true"
        else "false"
      }
      portalProtectionArea: ${toString portalProtectionArea}
      warpEffect: true
      warpParticles: PORTAL
      warpSound: BLOCK_PORTAL_TRAVEL
      showBungeeMessage: true
      portalInformationDisplayTime: 60
      stopWaterFlow: true
      throwbackStrength: 0.7
      commandDelay: 0
      playFailSound: true
      useOnlySpecialAxe: false
      enableCustomPortalBlocks: true
    '';
  in {
    packages = forAllSystems (system: let
      pkgs = import nixpkgs {
        inherit system;
        config.allowUnfree = true;
      };
    in {
      default = pkgs.velocity;
      velocity = pkgs.velocity;
      paperServer = pkgs.papermc;
      advancedPortals = mkAdvancedPortals pkgs;
    });

    nixosConfigurations.minecraft = nixpkgs.lib.nixosSystem {
      system = "aarch64-linux";
      specialArgs = {
        inherit mkAdvancedPortals mkPortalsConfig;
      };
      modules = [
        ./configuration.nix
        ./hardware-configuration.nix
      ];
    };
  };
}
