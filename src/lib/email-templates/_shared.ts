export const brand = {
  bg: "#ffffff",
  navy: "#0F1A33",
  gold: "#C9A24B",
  ink: "#0F1A33",
  mute: "#5A6478",
  border: "#E5E7EB",
  paper: "#FAF8F3",
};

export const styles = {
  main: { backgroundColor: brand.bg, fontFamily: "Inter, Arial, sans-serif", color: brand.ink, margin: 0, padding: 0 },
  container: { maxWidth: "560px", margin: "0 auto", padding: "32px 24px" },
  header: { padding: "20px 24px", backgroundColor: brand.navy, borderRadius: "12px 12px 0 0", textAlign: "center" as const },
  brandText: { color: brand.gold, fontSize: "12px", letterSpacing: "0.3em", textTransform: "uppercase" as const, margin: 0, fontWeight: 600 },
  brandTitle: { color: "#ffffff", fontSize: "22px", margin: "6px 0 0", fontFamily: "Georgia, serif", fontWeight: 600 },
  card: { backgroundColor: "#ffffff", border: `1px solid ${brand.border}`, borderRadius: "0 0 12px 12px", padding: "32px 28px" },
  heading: { fontSize: "24px", fontFamily: "Georgia, serif", color: brand.navy, margin: "0 0 12px", fontWeight: 600 },
  text: { fontSize: "15px", lineHeight: "1.6", color: brand.ink, margin: "0 0 16px" },
  mute: { fontSize: "13px", lineHeight: "1.5", color: brand.mute, margin: "16px 0 0" },
  button: { backgroundColor: brand.navy, color: "#ffffff", padding: "12px 24px", borderRadius: "999px", textDecoration: "none", fontSize: "14px", fontWeight: 600, display: "inline-block" },
  divider: { borderTop: `1px solid ${brand.border}`, margin: "24px 0" },
  reasonBox: { backgroundColor: brand.paper, border: `1px solid ${brand.border}`, borderRadius: "8px", padding: "14px 16px", margin: "8px 0 16px", fontSize: "14px", color: brand.ink, lineHeight: "1.5" },
};
