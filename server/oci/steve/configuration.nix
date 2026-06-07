# NixOS configuration for the simple "steve" vanilla Minecraft server on OCI ARM.
# A single-world survival server (no Velocity proxy) used as the Steve bot
# testing target. Mirrors the steve dev flake's server, pinned to MC 26.1.2.
#
# Shared base (ssh, fail2ban, root keys, dev tooling) lives in ../common.nix.
{
  config,
  lib,
  pkgs,
  ...
}: let
  version = "26.1.2";

  # Vanilla 26.1.2 server jar (Mojang piston-data). 26.1.2 requires Java 25.
  serverJar = pkgs.fetchurl {
    url = "https://piston-data.mojang.com/v1/objects/97ccd4c0ed3f81bbb7bfacddd1090b0c56f9bc51/server.jar";
    sha256 = "0hnbxnghbbki3vlgwkrxnr06nj92ig6qzbqpzml4gxi8hg1yfiyd";
  };

  jdk = pkgs.jdk25;

  memoryMB = 8192;
  rconPassword = "minecraft-test-rcon";
  rconPort = 25575;
  difficulty = "peaceful"; # matches the steve dev server; set "normal" for a survival world

  jvmOpts = builtins.concatStringsSep " " [
    "-XX:+UseG1GC"
    "-XX:+ParallelRefProcEnabled"
    "-XX:MaxGCPauseMillis=200"
    "-XX:+UnlockExperimentalVMOptions"
    "-XX:+DisableExplicitGC"
    "-XX:G1NewSizePercent=30"
    "-XX:G1MaxNewSizePercent=40"
    "-XX:G1HeapRegionSize=8M"
    "-XX:G1ReservePercent=20"
    "-XX:G1HeapWastePercent=5"
    "-XX:G1MixedGCCountTarget=4"
    "-XX:InitiatingHeapOccupancyPercent=15"
    "-XX:G1MixedGCLiveThresholdPercent=90"
    "-XX:SurvivorRatio=32"
    "-XX:+PerfDisableSharedMem"
    "-XX:MaxTenuringThreshold=1"
  ];

  # Op the bot accounts (offline UUIDs) so they can run commands.
  opsJson = pkgs.writeText "ops.json" (builtins.toJSON [
    {uuid = "8cf67a27-46d2-366b-b426-26e174de7007"; name = "Bird47"; level = 4; bypassesPlayerLimit = true;}
    {uuid = "5627dd98-e6be-3c21-b8a8-e92344183641"; name = "Steve"; level = 4; bypassesPlayerLimit = true;}
    {uuid = "62ff0b01-b491-3228-9dff-e7512ac3df09"; name = "TestWood"; level = 4; bypassesPlayerLimit = true;}
    {uuid = "cfabfddb-9454-3464-89f6-4b9739b31378"; name = "TestMine"; level = 4; bypassesPlayerLimit = true;}
    {uuid = "bc62a0e8-28ba-3990-bb75-3243edbaaaae"; name = "TestCraft"; level = 4; bypassesPlayerLimit = true;}
    {uuid = "6cb83f7d-6083-337e-9f3b-fc432b78c868"; name = "TestSmelt"; level = 4; bypassesPlayerLimit = true;}
    {uuid = "6d9e2f2c-1a69-3188-a71c-1b083e2c913a"; name = "TestCombat"; level = 4; bypassesPlayerLimit = true;}
    {uuid = "8158f5a2-defc-329c-85bf-e0bf4cd705fd"; name = "TestFood"; level = 4; bypassesPlayerLimit = true;}
    {uuid = "90e75911-9640-3547-ab02-f3bf7935d34b"; name = "TestNether"; level = 4; bypassesPlayerLimit = true;}
    {uuid = "c24246ee-47cc-3053-bbec-cf068c18fa59"; name = "TestEnd"; level = 4; bypassesPlayerLimit = true;}
  ]);
in {
  imports = [../common.nix];

  networking.hostName = "steve";
  networking.firewall = {
    enable = true;
    allowedTCPPorts = [
      22 # SSH
      25565 # Minecraft (PUBLIC)
    ];
    # RCON (25575) is intentionally NOT opened — bound to localhost only.
  };

  # Interactive dev user (SSH login, sudo, home-manager environment).
  users.users.bridger = {
    isNormalUser = true;
    extraGroups = ["wheel"];
    openssh.authorizedKeys.keys = [
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAID5mdblREEnjNE8hqgViMurQOrDMPVeW46u9Jbw1oqwB bridger@nixos"
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIM2/0RiMdk6keMhpqmui0J0USiRQ8Mqy7meOOEPAgVHx bridger@bridgers-MacBook-Pro.local"
    ];
  };
  security.sudo.wheelNeedsPassword = false;
  nix.settings.trusted-users = ["root" "bridger"];

  home-manager.useGlobalPkgs = true;
  home-manager.useUserPackages = true;
  home-manager.backupFileExtension = "bak";
  home-manager.users.bridger = import ./home.nix;

  users.users.minecraft = {
    isSystemUser = true;
    group = "minecraft";
    home = "/var/lib/minecraft";
    createHome = true;
    homeMode = "755";
  };
  users.groups.minecraft = {};

  systemd.tmpfiles.rules = [
    "d /var/lib/minecraft 0755 minecraft minecraft -"
  ];

  systemd.services.minecraft-server = {
    description = "Steve vanilla Minecraft server (${version})";
    wantedBy = ["multi-user.target"];
    after = ["network.target"];

    serviceConfig = {
      Type = "simple";
      User = "minecraft";
      Group = "minecraft";
      WorkingDirectory = "/var/lib/minecraft";
      Restart = "always";
      RestartSec = "10s";

      ExecStartPre = pkgs.writeShellScript "minecraft-setup.sh" ''
        cd /var/lib/minecraft

        echo "eula=true" > eula.txt

        cat > server.properties << 'PROPS'
        max-players=100
        online-mode=false
        pvp=false
        difficulty=${difficulty}
        gamemode=survival
        enable-command-block=true
        spawn-protection=0
        view-distance=10
        simulation-distance=6
        server-port=25565
        server-ip=0.0.0.0
        level-seed=typecraft
        level-type=minecraft:normal
        generate-structures=true
        motd=Steve Bot Server (${version})
        white-list=false
        spawn-monsters=true
        spawn-animals=true
        spawn-npcs=true
        allow-flight=false
        rate-limit=0
        enable-rcon=true
        rcon.password=${rconPassword}
        rcon.port=${toString rconPort}
        broadcast-rcon-to-ops=true
        PROPS

        cp -f ${opsJson} ops.json
        chmod +w server.properties ops.json
      '';

      ExecStart = "${jdk}/bin/java -Xms1G -Xmx${toString memoryMB}M ${jvmOpts} -jar ${serverJar} nogui";
    };
  };

  # MC server Java + dev tooling (shared CLI tools live in ../common.nix).
  environment.systemPackages = with pkgs; [
    jdk
    nodejs_24
    python3
    gnumake
  ];
}
