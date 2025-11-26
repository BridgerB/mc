{
  lib,
  stdenv,
  fetchurl,
  jre_headless,
  makeWrapper,
  version,
  url,
  sha1 ? "",
  sha256 ? "",
}:
stdenv.mkDerivation {
  pname = "minecraft-server";
  inherit version;

  src = fetchurl {
    inherit url;
    ${
      if sha1 != ""
      then "sha1"
      else null
    } =
      sha1;
    ${
      if sha256 != ""
      then "sha256"
      else null
    } =
      sha256;
  };

  preferLocalBuild = true;

  nativeBuildInputs = [makeWrapper];

  installPhase = ''
    runHook preInstall

    install -Dm644 $src $out/lib/minecraft/server.jar

    makeWrapper ${lib.getExe jre_headless} $out/bin/minecraft-server \
      --append-flags "-jar $out/lib/minecraft/server.jar nogui"

    runHook postInstall
  '';

  dontUnpack = true;

  meta = with lib; {
    description = "Minecraft Server (Paper)";
    homepage = "https://papermc.io";
    sourceProvenance = with sourceTypes; [binaryBytecode];
    license = licenses.unfree;
    platforms = platforms.unix;
    mainProgram = "minecraft-server";
  };
}
