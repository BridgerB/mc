{
  description = "Velocity proxy server with multiple Paper backend servers";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };

        # Velocity proxy package
        velocity = pkgs.callPackage ./velocity.nix {};

        # Paper server - latest 1.21.4
        paperServer = pkgs.callPackage ./minecraft-server.nix {
          version = "1.21.4";
          url = "https://api.papermc.io/v2/projects/paper/versions/1.21.4/builds/90/downloads/paper-1.21.4-90.jar";
          sha256 = "sha256-lJji2lWZkQsGP9iYBOPVxhFtUIjq+/ADWm76W2DYcdI=";
        };

        # Helper function to create a Paper server wrapper
        mkPaperServer = {
          name,
          port,
          worldName ? "world",
        }:
          pkgs.writeShellScriptBin "paper-${name}" ''
            set -e

            # Create server directory
            SERVER_DIR="$PWD/.servers/${name}"
            mkdir -p "$SERVER_DIR"
            cd "$SERVER_DIR"

            # Link to Paper jar (don't copy - it's read-only in Nix store)
            if [ ! -f server.jar ]; then
              ln -sf ${paperServer}/lib/minecraft/server.jar ./server.jar
            fi

            # World will be generated automatically by Minecraft

            # Generate server.properties
            {
              echo "# Server: ${name}"
              echo "server-port=${toString port}"
              echo "online-mode=false"
              echo "enable-query=false"
              echo "enable-rcon=false"
              echo "motd=§6${name} Server"
              echo "max-players=100"
              echo "level-name=${worldName}"
              echo "gamemode=${
              if name == "creative"
              then "creative"
              else "survival"
            }"
              echo "difficulty=peaceful"
              echo "pvp=${
              if name == "survival"
              then "true"
              else "false"
            }"
              echo "spawn-protection=0"
            } > server.properties

            # Setup Velocity forwarding configuration
            mkdir -p config

            # Always update paper-global.yml before starting server
            if [ -f config/paper-global.yml ] && [ -n "$VELOCITY_SECRET" ]; then
              # Update existing config with correct secret and enable velocity
              sed -i '/velocity:/,/secret:/ {
                s|enabled: false|enabled: true|
                s|secret: .*|secret: "'"$VELOCITY_SECRET"'"|
              }' config/paper-global.yml
            else
              # Create initial config with velocity settings
              {
                echo "_version: 29"
                echo "proxies:"
                echo "  velocity:"
                echo "    enabled: true"
                echo "    online-mode: true"
                echo "    secret: \"$VELOCITY_SECRET\""
              } > config/paper-global.yml
            fi

            # Accept EULA
            echo "eula=true" > eula.txt

            # Start server
            echo "Starting ${name} server on port ${toString port}..."
            exec ${pkgs.jre_headless}/bin/java \
              -Xms2G -Xmx2G \
              -XX:+UseG1GC \
              -XX:+ParallelRefProcEnabled \
              -XX:MaxGCPauseMillis=200 \
              -XX:+UnlockExperimentalVMOptions \
              -XX:+DisableExplicitGC \
              -XX:G1NewSizePercent=30 \
              -XX:G1MaxNewSizePercent=40 \
              -XX:G1HeapRegionSize=8M \
              -XX:G1ReservePercent=20 \
              -XX:G1HeapWastePercent=5 \
              -XX:G1MixedGCCountTarget=4 \
              -XX:InitiatingHeapOccupancyPercent=15 \
              -XX:G1MixedGCLiveThresholdPercent=90 \
              -XX:G1RSetUpdatingPauseTimePercent=5 \
              -XX:SurvivorRatio=32 \
              -XX:+PerfDisableSharedMem \
              -XX:MaxTenuringThreshold=1 \
              -jar server.jar nogui
          '';

        # Velocity proxy wrapper
        velocityProxy = pkgs.writeShellScriptBin "velocity-proxy" ''
          set -e

          # Save the original working directory
          ORIGINAL_DIR="$PWD"

          # Create proxy directory
          PROXY_DIR="$PWD/.servers/velocity"
          mkdir -p "$PROXY_DIR"
          cd "$PROXY_DIR"

          # Use the shared secret from the secret file (in original directory)
          SECRET_FILE="$ORIGINAL_DIR/.servers/velocity-secret"
          if [ ! -f "$SECRET_FILE" ]; then
            echo "Error: Velocity secret file not found at $SECRET_FILE"
            echo "Please run 'nix run .#all' to generate the secret first"
            exit 1
          fi

          SECRET=$(cat "$SECRET_FILE")

          # Generate velocity.toml from template if it doesn't exist
          if [ ! -f velocity.toml ]; then
            cp ${./velocity.toml.template} velocity.toml
          fi

          # Create forwarding secret file (Velocity 3.4+ expects a file, not inline config)
          echo -n "$SECRET" > forwarding.secret

          # Update velocity.toml to use the secret file
          sed -i 's|forwarding-secret = "YOUR_SECRET_HERE"|forwarding-secret-file = "forwarding.secret"|g' velocity.toml

          # Start Velocity
          echo "Starting Velocity proxy on port 25577..."
          exec ${velocity}/bin/velocity
        '';

        # All-in-one startup script
        startAll = pkgs.writeShellScriptBin "start-all" ''
          set -e

          echo "=========================================="
          echo "  Velocity + Paper Multi-Server Network"
          echo "=========================================="
          echo ""
          echo "This will start:"
          echo "  - Velocity Proxy (port 25577)"
          echo "  - Lobby Server (port 25565)"
          echo "  - Creative Server (port 25566)"
          echo "  - Survival Server (port 25567)"
          echo ""
          echo "Press Ctrl+C to stop all servers"
          echo ""

          # Create servers directory
          mkdir -p .servers

          # Generate or load secret
          SECRET_FILE=".servers/velocity-secret"
          if [ ! -f "$SECRET_FILE" ]; then
            ${pkgs.openssl}/bin/openssl rand -base64 32 > "$SECRET_FILE"
            echo "Generated new Velocity secret"
          fi
          export VELOCITY_SECRET=$(cat "$SECRET_FILE")

          echo "Starting servers..."
          echo ""

          # Start Paper servers in background
          ${mkPaperServer {
            name = "lobby";
            port = 25565;
          }}/bin/paper-lobby &
          LOBBY_PID=$!

          ${mkPaperServer {
            name = "creative";
            port = 25566;
          }}/bin/paper-creative &
          CREATIVE_PID=$!

          ${mkPaperServer {
            name = "survival";
            port = 25567;
          }}/bin/paper-survival &
          SURVIVAL_PID=$!

          # Wait for servers to start
          sleep 10

          # Start Velocity proxy
          ${velocityProxy}/bin/velocity-proxy &
          VELOCITY_PID=$!

          # Cleanup function
          cleanup() {
            echo ""
            echo "Stopping all servers..."
            kill $VELOCITY_PID $LOBBY_PID $CREATIVE_PID $SURVIVAL_PID 2>/dev/null || true
            wait
            echo "All servers stopped"
          }

          trap cleanup EXIT INT TERM

          echo ""
          echo "=========================================="
          echo "All servers started successfully!"
          echo "=========================================="
          echo ""
          echo "Connect to: localhost:25577"
          echo ""
          echo "SECURITY NOTE:"
          echo "Backend servers are in OFFLINE MODE for Velocity."
          echo "Make sure to:"
          echo "  - Use a firewall to block direct access to ports 25565-25567"
          echo "  - Only allow connections to port 25577 (Velocity)"
          echo "  - Keep the secret in .servers/velocity-secret private"
          echo ""

          # Wait for all processes
          wait
        '';
      in {
        packages = {
          inherit velocity paperServer;
          velocity-proxy = velocityProxy;
          paper-lobby = mkPaperServer {
            name = "lobby";
            port = 25565;
          };
          paper-creative = mkPaperServer {
            name = "creative";
            port = 25566;
          };
          paper-survival = mkPaperServer {
            name = "survival";
            port = 25567;
          };
          start-all = startAll;
          default = startAll;
        };

        apps = {
          velocity = {
            type = "app";
            program = "${velocityProxy}/bin/velocity-proxy";
          };
          lobby = {
            type = "app";
            program = "${mkPaperServer {
              name = "lobby";
              port = 25565;
            }}/bin/paper-lobby";
          };
          creative = {
            type = "app";
            program = "${mkPaperServer {
              name = "creative";
              port = 25566;
            }}/bin/paper-creative";
          };
          survival = {
            type = "app";
            program = "${mkPaperServer {
              name = "survival";
              port = 25567;
            }}/bin/paper-survival";
          };
          all = {
            type = "app";
            program = "${startAll}/bin/start-all";
          };
          default = {
            type = "app";
            program = "${startAll}/bin/start-all";
          };
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            jdk21
            velocity
            paperServer
            openssl
            curl
            wget
          ];

          shellHook = ''
            echo "Velocity + Paper Multi-Server Environment"
            echo ""
            echo "Available commands:"
            echo "  nix run .#all        - Start all servers"
            echo "  nix run .#velocity   - Start Velocity proxy only"
            echo "  nix run .#lobby      - Start lobby server only"
            echo "  nix run .#creative   - Start creative server only"
            echo "  nix run .#survival   - Start survival server only"
            echo ""
            echo "Java version:"
            java -version 2>&1 | head -n 1
          '';
        };
      }
    );
}
