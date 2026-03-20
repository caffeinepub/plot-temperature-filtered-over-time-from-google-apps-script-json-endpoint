// Hidden component to prevent build system from pruning PWA icon assets.
// This img tag is invisible but ensures the icon is included in the compiled output.
export function PWAAssets() {
  return (
    <div style={{ display: "none" }} aria-hidden="true">
      <img src="/assets/uploads/ICONV2-1.png" alt="" />
    </div>
  );
}
