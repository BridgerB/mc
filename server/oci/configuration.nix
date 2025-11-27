# NixOS Configuration for Velocity Proxy + Paper Servers on OCI ARM
{
  config,
  lib,
  pkgs,
  ...
}: let
  # Import user-specific configuration
  userConfig = import ./config.nix;
  # Velocity and Paper packages from nixpkgs
  # Velocity: 3.4.0-unstable-2025-11-09
  # Paper: 1.21.10-91
  velocity = pkgs.velocity;
  paperServer = pkgs.papermc;

  # Shared forwarding secret path
  secretFile = "/var/lib/velocity/forwarding.secret";

  # Helper to create Paper server configuration
  mkPaperServer = {
    name,
    port,
    gamemode ? "survival",
    pvp ? true,
    difficulty ? "normal",
    memoryMB ? 4096,
  }: {
    "minecraft-${name}" = {
      description = "Paper Minecraft Server - ${name}";
      wantedBy = ["multi-user.target"];
      after = ["network.target" "velocity-proxy.service"];
      requires = ["velocity-proxy.service"];

      serviceConfig = {
        Type = "simple";
        User = "minecraft";
        Group = "minecraft";
        WorkingDirectory = "/var/lib/minecraft/${name}";
        Restart = "always";
        RestartSec = "10s";

        # Setup script
        ExecStartPre = pkgs.writeShellScript "paper-${name}-setup.sh" ''
          cd /var/lib/minecraft/${name}

          # Accept EULA
          echo "eula=true" > eula.txt

          # Create server.properties
          cat > server.properties << 'PROPS'
          server-port=${toString port}
          server-ip=127.0.0.1
          max-players=20
          difficulty=${difficulty}
          gamemode=${gamemode}
          pvp=${
            if pvp
            then "true"
            else "false"
          }
          motd=${name} server (via Velocity)
          online-mode=false
          enable-command-block=false
          spawn-protection=0
          max-world-size=29999984
          level-name=world
          level-seed=
          level-type=minecraft\:normal
          allow-nether=true
          allow-flight=false
          PROPS

          # Create config directory for Paper
          mkdir -p config

          # Configure Paper with Velocity modern forwarding
          # Read the secret and substitute it into the config
          SECRET=$(cat ${secretFile})
          cat > config/paper-global.yml << YAML
          proxies:
            velocity:
              enabled: true
              online-mode: true
              secret: "$SECRET"
          YAML

          echo "Paper ${name} server setup complete"
        '';

        # Start Paper server - use nixpkgs papermc
        ExecStart = "${pkgs.jdk21}/bin/java -Xms${
          toString memoryMB
        }M -Xmx${
          toString memoryMB
        }M -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -jar ${paperServer}/share/papermc/papermc.jar nogui";
      };
    };
  };
in {
  imports = [./hardware-configuration.nix];

  # Allow unfree packages (required for Minecraft/Paper server)
  nixpkgs.config.allowUnfree = true;

  # Boot loader configuration
  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  # Networking
  networking.hostName = "minecraft";
  networking.firewall = {
    enable = true;
    allowedTCPPorts = [
      22 # SSH
      25565 # Velocity Proxy (PUBLIC)
      # Backend servers (25566-25568) are NOT exposed - internal only
    ];
  };

  # SSH with strict security
  services.openssh = {
    enable = true;
    settings = {
      PermitRootLogin = "prohibit-password";
      PasswordAuthentication = false;
      KbdInteractiveAuthentication = false;
    };
  };

  # fail2ban for brute-force protection
  services.fail2ban = {
    enable = true;
    maxretry = 5;
    ignoreIP = [
      "127.0.0.1/8"
      "10.0.0.0/8"
    ];
  };

  # Root user with SSH keys
  users.users.root = {
    openssh.authorizedKeys.keys = userConfig.sshKeys;
  };

  # Velocity user (shares minecraft group)
  users.users.velocity = {
    isSystemUser = true;
    group = "minecraft";
    home = "/var/lib/velocity";
    createHome = true;
  };

  # Minecraft user for Paper servers
  users.users.minecraft = {
    isSystemUser = true;
    group = "minecraft";
    home = "/var/lib/minecraft";
    createHome = true;
  };
  users.groups.minecraft = {};

  # Create server directories
  systemd.tmpfiles.rules = [
    "d /var/lib/minecraft/lobby 0755 minecraft minecraft -"
    "d /var/lib/minecraft/creative 0755 minecraft minecraft -"
    "d /var/lib/minecraft/survival 0755 minecraft minecraft -"
  ];

  # Velocity Proxy + Paper Server Services
  systemd.services =
    {
      # Velocity Proxy Service
      velocity-proxy = {
        description = "Velocity Minecraft Proxy";
        wantedBy = ["multi-user.target"];
        after = ["network.target"];

        serviceConfig = {
          Type = "simple";
          User = "velocity";
          Group = "minecraft";
          WorkingDirectory = "/var/lib/velocity";
          Restart = "always";
          RestartSec = "10s";

          # Setup script - generates secret and configures Velocity
          ExecStartPre = pkgs.writeShellScript "velocity-setup.sh" ''
            cd /var/lib/velocity

            # Make velocity directory accessible to minecraft group
            chmod 755 /var/lib/velocity

            # Generate forwarding secret if it doesn't exist
            if [ ! -f forwarding.secret ]; then
              echo "Generating forwarding secret..."
              ${pkgs.openssl}/bin/openssl rand -base64 32 > forwarding.secret
              chmod 644 forwarding.secret
              chown velocity:minecraft forwarding.secret
              echo "Forwarding secret generated"
            fi

            # Ensure secret is readable (in case it was created with wrong perms before)
            chmod 644 forwarding.secret

            # Always copy velocity.toml configuration (overwrite to get latest changes)
            echo "Installing Velocity configuration..."
            cp ${./velocity.toml} velocity.toml
            chmod 644 velocity.toml

            echo "Velocity proxy setup complete"
          '';

          # Start Velocity proxy
          ExecStart = "${velocity}/bin/velocity";
        };
      };
    }
    // # Paper Server Services (3 servers: lobby, creative, survival)
    mkPaperServer {
      name = "lobby";
      port = 25566;
      gamemode = "survival";
      pvp = false;
      difficulty = "normal";
      memoryMB = 4096;
    }
    // mkPaperServer {
      name = "creative";
      port = 25567;
      gamemode = "creative";
      pvp = false;
      difficulty = "peaceful";
      memoryMB = 4096;
    }
    // mkPaperServer {
      name = "survival";
      port = 25568;
      gamemode = "survival";
      pvp = true;
      difficulty = "hard";
      memoryMB = 4096;
    };

  # Essential system administration tools
  environment.systemPackages = with pkgs; [
    vim
    git
    tmux
    htop
    btop
    curl
    wget
    jq
    ripgrep
    fd
    ncdu
    duf
    lsof
    strace
    tcpdump
    iftop
    jdk21 # Java 21 for Minecraft
  ];

  # NixOS system state version
  system.stateVersion = "25.11";
}
