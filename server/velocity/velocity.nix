{
  lib,
  stdenv,
  fetchurl,
  jre_headless,
  makeWrapper,
}:
stdenv.mkDerivation rec {
  pname = "velocity";
  version = "3.4.0-SNAPSHOT-513";

  src = fetchurl {
    url = "https://api.papermc.io/v2/projects/velocity/versions/3.4.0-SNAPSHOT/builds/513/downloads/velocity-3.4.0-SNAPSHOT-513.jar";
    sha256 = "sha256-g7QqkjIL5pF4LiTlAxwEJ1APjauZbWf8vVc+dTzCahk=";
  };

  dontUnpack = true;

  nativeBuildInputs = [makeWrapper];

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin $out/share/velocity
    cp $src $out/share/velocity/velocity.jar

    makeWrapper ${lib.getExe jre_headless} "$out/bin/velocity" \
      --append-flags "-Xms1G -Xmx1G -XX:+UseG1GC -XX:G1HeapRegionSize=4M -XX:+UnlockExperimentalVMOptions -XX:+ParallelRefProcEnabled -XX:+AlwaysPreTouch -XX:MaxInlineLevel=15" \
      --append-flags "-jar $out/share/velocity/velocity.jar"

    runHook postInstall
  '';

  meta = with lib; {
    description = "Modern, next-generation Minecraft server proxy";
    homepage = "https://papermc.io/software/velocity";
    license = licenses.gpl3Only;
    platforms = platforms.linux;
    mainProgram = "velocity";
  };
}
