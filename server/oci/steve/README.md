# steve — simple vanilla Minecraft server (OCI)

A single-world survival server with no Velocity proxy, used as the Steve bot
testing target. Pinned to **Minecraft 26.1.2** (which requires **Java 25** —
`pkgs.jdk25`). Mirrors the steve dev flake's server: offline-mode, RCON on
`localhost:25575`, and the bot accounts pre-opped.

Runs as the `minecraft-server` systemd unit out of `/var/lib/minecraft`. Unlike
the dev flake it does **not** wipe the world on restart — the world persists.

## Deploy

```bash
cd server/oci
./deploy.ts <public-ip> steve
ssh root@<public-ip> 'systemctl status minecraft-server'
```

## Bumping the Minecraft version

Edit `configuration.nix`:

1. Set `version`.
2. Update `serverJar.url` + `sha256` (get the URL from Mojang's
   `version_manifest_v2.json` → per-version JSON `downloads.server`; get the Nix
   hash with `nix-prefetch-url <url>`).
3. Update `jdk` if the new version needs a different Java major.

## Notes

- **`online-mode=false`** so the bot's offline-UUID accounts can join. This is
  required for the bots but means anyone can connect as any username — fine for a
  throwaway bot world, reconsider for anything public.
- RCON port 25575 is **not** opened in the firewall (localhost only).
