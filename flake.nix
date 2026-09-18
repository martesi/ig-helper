{
  description = "IG Helper development shells";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      devPackages = [ pkgs.bun ];
      scriptcat = pkgs.fetchzip {
        url = "https://github.com/scriptscat/scriptcat/releases/download/v1.4.0/scriptcat-v1.4.0-chrome.zip";
        hash = "sha256-a/3LMhAoSsjzSeDOj6bwB1QW21bM8gbdWVkq9AdwzR8=";
        stripRoot = false;
      };
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
            export IG_HELPER_E2E_CHROMIUM="${pkgs.chromium}/bin/chromium"
            export IG_HELPER_E2E_EXTENSION="${scriptcat}"
            export IG_HELPER_E2E_PROFILE_DIR="''${IG_HELPER_E2E_PROFILE_DIR:-$PWD/.browser-state/playwright}"
            if [ -z "''${IG_HELPER_E2E_CSP_EXTENSION:-}" ] && [ -d "$HOME/.agents/skills/e2e/assets/disable-csp" ]; then
              export IG_HELPER_E2E_CSP_EXTENSION="$HOME/.agents/skills/e2e/assets/disable-csp"
            fi

            export AGENT_BROWSER_SESSION="''${AGENT_BROWSER_SESSION:-ig-helper-agent}"
            export AGENT_BROWSER_PROFILE="''${AGENT_BROWSER_PROFILE:-$PWD/.browser-state/agent}"
            export AGENT_BROWSER_EXECUTABLE_PATH="''${AGENT_BROWSER_EXECUTABLE_PATH:-${pkgs.chromium}/bin/chromium}"
            export AGENT_BROWSER_EXTENSIONS="''${AGENT_BROWSER_EXTENSIONS:-${scriptcat}}"
          '';
        };
      };
    };
}
