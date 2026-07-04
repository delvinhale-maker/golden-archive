import { useEffect, useRef, useState } from "react";

export function MissionSection() {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      aria-labelledby="mission-heading"
      style={{
        backgroundColor: "#0F1E35",
        borderTop: "1px solid rgba(184,134,11,0.25)",
        padding: "80px 24px",
      }}
      className="relative overflow-hidden"
    >
      {/* Soft gold radial gradient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "min(900px, 90%)",
          height: "520px",
          background:
            "radial-gradient(ellipse at center, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.08) 35%, rgba(15,30,53,0) 70%)",
          filter: "blur(4px)",
        }}
      />

      <div
        className="relative mx-auto flex flex-col items-center text-center"
        style={{
          maxWidth: 720,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(24px)",
          transition: "opacity 900ms ease-out, transform 900ms ease-out",
        }}
      >
        {/* Eyebrow */}
        <p
          className="uppercase tracking-[0.28em]"
          style={{
            color: "#D4AF37",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.28em",
          }}
        >
          ✦ Our Mission
        </p>

        {/* Animated gold divider */}
        <div
          aria-hidden
          className="mt-5"
          style={{
            height: 1,
            width: visible ? 96 : 0,
            background:
              "linear-gradient(90deg, rgba(212,175,55,0) 0%, rgba(212,175,55,0.9) 50%, rgba(212,175,55,0) 100%)",
            transition: "width 1200ms cubic-bezier(0.22, 1, 0.36, 1) 200ms",
          }}
        />

        {/* Heading */}
        <h2
          id="mission-heading"
          className="mt-8"
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            color: "#FFFFFF",
            fontSize: 32,
            lineHeight: 1.2,
            fontWeight: 400,
          }}
        >
          Why Kingdom Bible App Exists
        </h2>

        {/* Body */}
        <p
          className="mt-6"
          style={{
            color: "#8A9BB0",
            fontSize: 16,
            lineHeight: 1.8,
            maxWidth: 600,
          }}
        >
          Kingdom Bible App exists to help people know God more deeply through
          His Word by combining timeless biblical truth with modern technology.
          Our mission is to equip believers to grow spiritually every day
          through Scripture, prayer, biblical teaching, and Kingdom principles
          that can be applied in everyday life.
        </p>

        {/* Scripture reference */}
        <p
          className="mt-8 italic"
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            color: "#D4AF37",
            fontSize: 15,
            letterSpacing: "0.04em",
          }}
        >
          “Seek first the kingdom of God and His righteousness.” — Matthew 6:33
        </p>
      </div>
    </section>
  );
}

export default MissionSection;
