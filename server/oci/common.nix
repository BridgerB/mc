# Shared base configuration for all OCI Minecraft hosts (velocity + steve).
# Imported by ./velocity/configuration.nix and ./steve/configuration.nix.
# Host-specific bits (hostname, firewall, services) live in those files.
{
  config,
  lib,
  pkgs,
  ...
}: let
  userConfig = import ./config.nix;
in {
  nixpkgs.config.allowUnfree = true;

  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  nix.settings = {
    experimental-features = ["nix-command" "flakes"];
    trusted-users = ["root"];
  };

  services.openssh = {
    enable = true;
    settings = {
      PermitRootLogin = "prohibit-password";
      PasswordAuthentication = false;
      KbdInteractiveAuthentication = false;
    };
  };

  services.fail2ban = {
    enable = true;
    maxretry = 5;
    ignoreIP = [
      "127.0.0.1/8"
      "10.0.0.0/8"
    ];
  };

  users.users.root.openssh.authorizedKeys.keys = userConfig.sshKeys;

  # Allow running dynamically linked binaries (e.g. Claude Code's native binary,
  # npx-installed tools) which NixOS otherwise can't exec. See nix.dev/permalink/stub-ld.
  programs.nix-ld.enable = true;
  programs.nix-ld.libraries = with pkgs; [
    stdenv.cc.cc
    zlib
    openssl
  ];

  # Dev tooling available on every host (merged from the velocity host list
  # and the steve dev environment's package list).
  environment.systemPackages = with pkgs; [
    # editors / shell
    vim
    neovim
    tmux
    zellij
    # monitoring
    htop
    btop
    ncdu
    duf
    lsof
    strace
    tcpdump
    iftop
    # net / fetch
    curl
    wget
    # search / files
    ripgrep
    fd
    tree
    jq
    zip
    unzip
    sqlite
    # git
    git
    gh
    lazygit
    delta
  ];

  system.stateVersion = "25.11";
}
