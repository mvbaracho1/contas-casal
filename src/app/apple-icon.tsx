import { ImageResponse } from "next/og";

// Ícone da tela inicial do iPhone (PNG gerado no build).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const circle = { width: 92, height: 92, borderRadius: 9999 };
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f2f4f8" }}>
        <div style={{ ...circle, background: "#2563eb", marginRight: -28 }} />
        <div style={{ ...circle, background: "#f43f5e", border: "8px solid #f2f4f8" }} />
      </div>
    ),
    size,
  );
}
