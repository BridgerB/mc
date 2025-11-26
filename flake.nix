{
  description = "Minecraft block color mapper - SvelteKit app with Deno services";

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
        pkgs = nixpkgs.legacyPackages.${system};

        # Script to run the block color mapper from current directory
        blockColorMapperScript = pkgs.writeShellScriptBin "block-color-mapper" ''
          export LD_LIBRARY_PATH="${pkgs.stdenv.cc.cc.lib}/lib:$LD_LIBRARY_PATH"
          exec ${pkgs.deno}/bin/deno run \
            --allow-read \
            --allow-write \
            --allow-env \
            --allow-run \
            --allow-sys \
            --allow-ffi \
            services/block-colors/main.ts
        '';
      in {
        # Development shell with all dependencies
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            deno
            nodejs_20 # Required for sharp native bindings
            unzip # For extracting Minecraft .jar files
            git
          ];

          shellHook = ''
            echo "🎮 Minecraft Block Color Mapper - Development Environment"
            echo "=================================================="
            echo "Deno: $(${pkgs.deno}/bin/deno --version | head -1)"
            echo "Node.js: $(${pkgs.nodejs_20}/bin/node --version)"
            echo ""
            echo "Available commands:"
            echo "  nix run .#block-color-mapper  - Generate blockmodel_avgs.json"
            echo "  deno task <task>              - Run tasks from deno.json"
            echo ""
          '';
        };

        # Runnable app
        apps.block-color-mapper = {
          type = "app";
          program = "${blockColorMapperScript}/bin/block-color-mapper";
        };

        # Default app (allows 'nix run')
        apps.default = self.apps.${system}.block-color-mapper;
      }
    );
}
