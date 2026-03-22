{
  description = "mc-bot-bench — typecraft vs mineflayer benchmarks";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
  };

  outputs = {
    self,
    nixpkgs,
  }: let
    system = "x86_64-linux";
    pkgs = import nixpkgs {
      inherit system;
      config.allowUnfree = true;
    };

    version = "1.21.11";
    serverPort = "23624"; # BENCH on T9 keypad
    rconPassword = "bench-rcon-pass";
    rconPort = "23625";

    serverJar = pkgs.fetchurl {
      url = "https://piston-data.mojang.com/v1/objects/64bb6d763bed0a9f1d632ec347938594144943ed/server.jar";
      sha256 = "09hpvmjnspf74k8ks9imcc3lqz8p3gjald3y3j9nz035704qwfzq";
    };

    jvmOpts = builtins.concatStringsSep " " [
      "-Xmx2G"
      "-Xms2G"
      "-XX:+UseG1GC"
      "-XX:+ParallelRefProcEnabled"
      "-XX:MaxGCPauseMillis=200"
    ];

    serverProperties = pkgs.writeText "server.properties" ''
      max-players=20
      online-mode=false
      pvp=true
      difficulty=normal
      gamemode=survival
      enable-command-block=true
      spawn-protection=0
      view-distance=10
      simulation-distance=6
      server-port=${serverPort}
      level-seed=12345
      motd=mc-bot-bench
      white-list=false
      spawn-monsters=true
      spawn-animals=true
      spawn-npcs=true
      allow-flight=true
      rate-limit=0
      enable-rcon=true
      rcon.password=${rconPassword}
      rcon.port=${rconPort}
      broadcast-rcon-to-ops=true
    '';

    opsJson = pkgs.writeText "ops.json" (builtins.toJSON [
      { uuid = "a9805a80-5ab5-3b97-8b43-aad49282c1f3"; name = "tc_pathfind"; level = 4; bypassesPlayerLimit = true; }
      { uuid = "53aec97e-3457-3f0e-a040-d5ff97bfcff1"; name = "mf_pathfind"; level = 4; bypassesPlayerLimit = true; }
      { uuid = "f426b68d-f1ce-356e-be29-0915e1fb4784"; name = "tc_mining"; level = 4; bypassesPlayerLimit = true; }
      { uuid = "7f77d2cf-9730-3817-9156-c9986ffe4bcc"; name = "mf_mining"; level = 4; bypassesPlayerLimit = true; }
      { uuid = "daf65c7d-4150-3442-ab06-9fc7f87a279f"; name = "tc_crafting"; level = 4; bypassesPlayerLimit = true; }
      { uuid = "177cd773-c1d5-3e60-bf0a-463c2c2189bb"; name = "mf_crafting"; level = 4; bypassesPlayerLimit = true; }
      { uuid = "848e31b4-d4c6-3023-a2bd-f993264bc5ed"; name = "tc_combat"; level = 4; bypassesPlayerLimit = true; }
      { uuid = "3f869de4-2a54-3f66-8cba-569b5696961a"; name = "mf_combat"; level = 4; bypassesPlayerLimit = true; }
      { uuid = "9e302fa9-900f-363b-a215-b0c292a60402"; name = "tc_trading"; level = 4; bypassesPlayerLimit = true; }
      { uuid = "eb1f6c21-a4b4-3a4a-8eeb-9644ecd143d3"; name = "mf_trading"; level = 4; bypassesPlayerLimit = true; }
    ]);

    rcon = pkgs.writeShellScriptBin "rcon" ''
      ${pkgs.mcrcon}/bin/mcrcon -H localhost -P ${rconPort} -p ${rconPassword} "$@"
    '';

    startServer = pkgs.writeShellScriptBin "minecraft-server" ''
      set -euo pipefail
      mkdir -p server
      cd server
      echo "eula=true" > eula.txt
      cp -f ${serverProperties} server.properties
      cp -f ${opsJson} ops.json
      chmod +w server.properties ops.json
      echo "Starting Minecraft Server ${version} for benchmarking..."
      echo "Server: localhost:${serverPort}  RCON: localhost:${rconPort}"
      exec ${pkgs.jre}/bin/java ${jvmOpts} -jar ${serverJar} nogui
    '';

    waitForServer = ''
      echo "Waiting for server RCON on localhost:${rconPort}..."
      while ! ${pkgs.netcat}/bin/nc -z localhost ${rconPort} 2>/dev/null; do
        sleep 1
      done
      while ! ${pkgs.mcrcon}/bin/mcrcon -H localhost -P ${rconPort} -p ${rconPassword} "list" 2>/dev/null | grep -q "players"; do
        sleep 2
      done
      echo "Server ready!"
    '';

    runBench = pkgs.writeShellScriptBin "run-bench" ''
      set -euo pipefail
      BENCH_DIR="''${BENCH_DIR:-$(pwd)}"
      cd "$BENCH_DIR"

      ${waitForServer}

      echo ""
      echo "Installing dependencies..."
      ${pkgs.nodejs}/bin/npm install --silent 2>/dev/null

      echo "Running benchmarks..."
      BENCH_PORT=${serverPort} ${pkgs.nodejs}/bin/npx tsx src/run-all.ts
    '';

    runSingle = pkgs.writeShellScriptBin "run-single" ''
      set -euo pipefail
      BENCH_DIR="''${BENCH_DIR:-$(pwd)}"
      cd "$BENCH_DIR"

      BENCH="''${1:-pathfind}"

      ${waitForServer}

      ${pkgs.nodejs}/bin/npm install --silent 2>/dev/null
      echo "Running bench: $BENCH"
      BENCH_PORT=${serverPort} ${pkgs.nodejs}/bin/npx tsx "src/$BENCH.ts"
    '';

    runAll = pkgs.writeShellScriptBin "run-all" ''
      set -euo pipefail
      export BENCH_DIR="$(pwd)"

      echo "=== mc-bot-bench: server + benchmarks ==="

      ${startServer}/bin/minecraft-server &
      SERVER_PID=$!
      trap "kill $SERVER_PID 2>/dev/null; wait $SERVER_PID 2>/dev/null" EXIT

      ${runBench}/bin/run-bench
    '';
  in {
    packages.${system} = {
      default = runAll;
      server = startServer;
      bench = runBench;
      single = runSingle;
      all = runAll;
      rcon = rcon;
    };

    apps.${system} = {
      default = {
        type = "app";
        program = "${runAll}/bin/run-all";
      };
      server = {
        type = "app";
        program = "${startServer}/bin/minecraft-server";
      };
      bench = {
        type = "app";
        program = "${runBench}/bin/run-bench";
      };
      single = {
        type = "app";
        program = "${runSingle}/bin/run-single";
      };
      all = {
        type = "app";
        program = "${runAll}/bin/run-all";
      };
      rcon = {
        type = "app";
        program = "${rcon}/bin/rcon";
      };
    };

    devShells.${system}.default = pkgs.mkShell {
      buildInputs = [
        startServer
        runBench
        runSingle
        runAll
        rcon
        pkgs.jre
        pkgs.nodejs
        pkgs.mcrcon
      ];
      shellHook = ''
        echo "mc-bot-bench — typecraft vs mineflayer"
        echo ""
        echo "  nix run                Start server + run all benchmarks"
        echo "  nix run .#server       Start MC server only (port 23624)"
        echo "  nix run .#bench        Run all benchmarks (server must be running)"
        echo "  nix run .#single pathfind   Run single benchmark"
        echo "  rcon <cmd>             Send RCON command"
        echo ""
        echo "Benchmarks: pathfind, mining, crafting, combat, trading"
        echo ""
      '';
    };
  };
}
