{
  description = "IG Helper development shells";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  inputs.llm-agents.url = "github:numtide/llm-agents.nix";

  outputs = { nixpkgs, llm-agents, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      devPackages = [ pkgs.bun llm-agents.packages.${system}.apm ];
    in
    {
      devShells.${system} = {
        default = pkgs.mkShell {
          packages = devPackages;
        };

        e2e = pkgs.mkShell {
          packages = [
            pkgs.xvfb
            pkgs.xdpyinfo
            pkgs.xdotool
            pkgs.imagemagick
            pkgs.fontconfig
            pkgs.chromium
          ] ++ devPackages;

          shellHook = ''
            export DISPLAY="''${DISPLAY:-:99}"
            export FONTCONFIG_FILE="''${FONTCONFIG_FILE:-${pkgs.makeFontsConf {
              fontDirectories = with pkgs; [ dejavu_fonts liberation_ttf ];
            }}}"
            export __EGL_VENDOR_LIBRARY_DIRS="''${__EGL_VENDOR_LIBRARY_DIRS:-${pkgs.mesa}/share/glvnd/egl_vendor.d}"
          '';
        };
      };
    };
}
