import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Mic, Send, Sparkles, Square } from "lucide-react";
import { askAurumGuide } from "@/lib/aurum-intelligence/guide.functions";

type Recommendation = Awaited<ReturnType<typeof askAurumGuide>>["recommendations"][number];

export function AurumGuide() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("Tell Aurum what you're trying to accomplish.");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const recognitionRef = useRef<any>(null);
  const sessionId = useRef(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "11111111-1111-4111-8111-111111111111");

  async function submit(channel: "text" | "voice" = "text", value = input) {
    if (busy || value.trim().length < 2) return;
    setBusy(true);
    try {
      const result = await askAurumGuide({ data: {
        sessionId: sessionId.current,
        channel,
        input: value,
        analyticsConsent,
        personalizationConsent: false,
      }});
      setMessage(result.message);
      setRecommendations(result.recommendations);
    } finally {
      setBusy(false);
    }
  }

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop?.();
      setListening(false);
      return;
    }
    const SpeechRecognition = typeof window !== "undefined"
      ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
      : null;
    if (!SpeechRecognition) {
      setMessage("Voice capture isn't available in this browser yet. You can type the same request below.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((r: any) => r[0]?.transcript ?? "").join(" ").trim();
      setInput(transcript);
      if (event.results[event.results.length - 1]?.isFinal && transcript) void submit("voice", transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <section aria-label="Aurum Guide" className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8">
      <div className="overflow-hidden rounded-3xl border border-line bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-center gap-2 text-gold-ink"><Sparkles size={18}/><span className="text-xs font-bold uppercase tracking-caps">Aurum Guide</span></div>
        <h2 className="mt-2 font-display text-2xl font-bold text-ink md:text-3xl">What are you trying to accomplish?</h2>
        <p className="mt-2 max-w-2xl text-sm text-mute">{message}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={toggleVoice} aria-label={listening ? "Stop listening" : "Talk to Aurum"} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink">
            {listening ? <Square size={17}/> : <Mic size={19}/>}
          </button>
          <input value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter") void submit();}} placeholder="e.g. I'm starting a cleaning business and need help pricing my services" className="h-12 min-w-0 flex-1 rounded-full border border-line px-5 text-sm outline-none focus:ring-2"/>
          <button type="button" disabled={busy || input.trim().length < 2} onClick={()=>void submit()} className="flex h-12 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white disabled:opacity-50"><Send size={16}/><span className="hidden sm:inline">Ask Aurum</span></button>
        </div>
        <label className="mt-3 flex items-start gap-2 text-xs text-mute">
          <input type="checkbox" checked={analyticsConsent} onChange={(e)=>setAnalyticsConsent(e.target.checked)} className="mt-0.5"/>
          Share an anonymous summary of what I need to help AurumVault identify missing marketplace solutions. Raw conversation text is not used for this aggregate signal.
        </label>
        {recommendations.length > 0 && <div className="mt-6 grid gap-3 md:grid-cols-3">
          {recommendations.slice(0,3).map((r)=><Link key={r.productId} to="/products/$id" params={{id:r.product.slug || r.product.id}} className="rounded-2xl border border-line p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-caps text-gold-ink">{r.product.category}</div>
            <div className="mt-1 font-display text-lg font-bold text-ink">{r.product.title}</div>
            <p className="mt-2 text-sm text-mute">{r.reason}</p>
            <div className="mt-3 text-xs font-semibold text-ink">Why this matches · {Math.round(r.score*100)}%</div>
          </Link>)}
        </div>}
      </div>
    </section>
  );
}
