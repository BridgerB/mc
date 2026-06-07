# OCI Minecraft servers

NixOS configs for the Oracle Cloud (OCI ARM) Minecraft hosts. One flake exposes
two `nixosConfigurations`:

| Config     | Dir          | What it is                                                        |
| ---------- | ------------ | ----------------------------------------------------------------- |
| `velocity` | `velocity/`  | Velocity proxy + Paper sub-worlds (lobby, creative, survival, …)  |
| `steve`    | `steve/`     | Simple single-world vanilla server (MC 26.1.2) for the Steve bot  |

## Layout

Shared files live at this directory's root and are imported by each config's
`configuration.nix` (`imports = [ ../common.nix ]`). A Nix flake can't import
files outside its own root, so both configs share one flake here rather than a
flake per subdir.

```
server/oci/
├── flake.nix                 # nixosConfigurations.velocity + .steve
├── common.nix                # shared base: ssh, fail2ban, root keys, dev tools
├── config.nix                # ssh keys (personal)
├── config.ts                 # OCI OCIDs (personal)
├── launch.ts                 # launch an OCI instance
├── deploy.ts                 # ./deploy.ts <ip> velocity|steve
├── hardware-configuration.nix# placeholder (real one generated on server)
├── velocity/                 # velocity proxy network
└── steve/                    # simple vanilla 26.1.2 server
```

## Deploy

```bash
cd server/oci

# build-test locally (no aarch64 builder needed for eval):
nix eval .#nixosConfigurations.steve.config.system.build.toplevel.drvPath

# deploy to a running instance:
./deploy.ts <public-ip> steve      # or: velocity
```

`config.nix` and `config.ts` carry personal SSH keys / OCI identifiers. They are
currently committed — keep that in mind before sharing this repo.
