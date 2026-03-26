{pkgs, ...}: {
  home.stateVersion = "25.11";

  home.packages = with pkgs; [
    ripgrep
    fd
    jq
    gh
    tree
    zip
    unzip
    vim
    htop
  ];

  home.shellAliases = {
    claude = "npx @anthropic-ai/claude-code@latest --dangerously-skip-permissions";
  };

  programs.bash.enable = true; # required for home.shellAliases to land in .bashrc

  programs.zellij = {
    enable = true;
    enableBashIntegration = true;
    layouts = {
      steve = ''
        layout {
          default_tab_template {
            pane size=1 borderless=true {
              plugin location="zellij:tab-bar"
            }
            children
            pane size=2 borderless=true {
              plugin location="zellij:status-bar"
            }
          }
          tab name="steve" cwd="/home/bridger/Developer/steve" {
            pane
          }
          tab name="typecraft" cwd="/home/bridger/Developer/typecraft" {
            pane
          }
          tab name="server" cwd="/home/bridger/Developer/steve" {
            pane command="nix" {
              args "run" ".#server"
            }
          }
        }
      '';
    };
  };
}
