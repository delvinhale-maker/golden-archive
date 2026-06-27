import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { BadgeCheck, MessageCircleQuestion, LogIn, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  listQA,
  askQuestion,
  answerQuestion,
  deleteQuestion,
  type QARow,
} from "@/lib/qa.functions";
import { useAuth } from "@/hooks/use-auth";

export function QASection({ productId }: { productId: string }) {
  const list = useServerFn(listQA);
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["qa", productId];
  const { data } = useQuery({
    queryKey,
    queryFn: () => list({ data: { productId } }),
    staleTime: 30_000,
  });
  const items: QARow[] = data?.items ?? [];

  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
            Questions &amp; Answers
          </h2>
          <p className="mt-1 text-sm text-mute">
            {items.length} {items.length === 1 ? "question" : "questions"}
          </p>
        </div>
        {user ? (
          <AskButton productId={productId} queryKey={queryKey} />
        ) : (
          <Link
            to="/auth"
            search={{ redirect: `/products/${productId}` }}
            className="inline-flex items-center gap-2 rounded-full border-2 border-gold px-4 py-2 text-sm font-bold text-gold hover:bg-[var(--accent)]"
          >
            <LogIn size={14} /> Sign in to ask
          </Link>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
            <MessageCircleQuestion size={28} className="mx-auto text-mute" />
            <p className="mt-3 text-sm text-mute">
              No questions yet. Be the first to ask.
            </p>
          </div>
        ) : (
          items.map((q) => (
            <QACard key={q.id} q={q} queryKey={queryKey} currentUserId={user?.id ?? null} />
          ))
        )}
      </div>
    </section>
  );
}

function QACard({
  q,
  queryKey,
  currentUserId,
}: {
  q: QARow;
  queryKey: readonly unknown[];
  currentUserId: string | null;
}) {
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState("");
  const answer$ = useServerFn(answerQuestion);
  const del$ = useServerFn(deleteQuestion);
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = useAuth().isAdmin ?? false;
  const isAsker = currentUserId && q.asker_user_id === currentUserId;

  const m = useMutation({
    mutationFn: () => answer$({ data: { questionId: q.id, answer } }),
    onSuccess: () => {
      toast.success("Answer posted");
      qc.invalidateQueries({ queryKey });
      setAnswering(false);
      setAnswer("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to post"),
  });

  const dm = useMutation({
    mutationFn: () => del$({ data: { questionId: q.id } }),
    onSuccess: () => {
      toast.success("Question removed");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete"),
  });

  const askedDate = new Date(q.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-xs font-bold text-gold">
          Q
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">{q.question}</p>
          <p className="mt-1 text-xs text-mute">
            Asked by {q.asker_name} · {askedDate}
          </p>
        </div>
        {(isAsker || isAdmin) && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Delete this question?")) dm.mutate();
            }}
            disabled={dm.isPending}
            className="rounded-full p-1.5 text-mute hover:text-red-600"
            aria-label="Delete question"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {q.answer ? (
        <div className="mt-4 flex items-start gap-3 rounded-md bg-[#f9fafb] p-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold text-xs font-bold text-navy">
            A
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-ink">{q.answer}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-mute">
              <span className="font-semibold text-ink">{q.answerer_name}</span>
              {q.answered_by_admin && (
                <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-caps text-gold">
                  <BadgeCheck size={11} /> Illustrious Capital™
                </span>
              )}
              {q.answered_at && (
                <span>
                  ·{" "}
                  {new Date(q.answered_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </p>
          </div>
        </div>
      ) : isAdmin ? (
        <div className="mt-4">
          {answering ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-md border border-line p-3"
            >
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={3}
                placeholder="Answer this question…"
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => setAnswering(false)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-mute hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  onClick={() => m.mutate()}
                  disabled={m.isPending || answer.trim().length < 2}
                  className="rounded-full bg-gold px-4 py-1.5 text-xs font-bold text-navy disabled:opacity-50"
                >
                  {m.isPending ? "Posting…" : "Post answer"}
                </button>
              </div>
            </motion.div>
          ) : (
            <button
              onClick={() => setAnswering(true)}
              className="text-xs font-semibold text-gold hover:underline"
            >
              + Answer as Illustrious Capital™
            </button>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs italic text-mute">Awaiting an answer.</p>
      )}
    </div>
  );
}

function AskButton({
  productId,
  queryKey,
}: {
  productId: string;
  queryKey: readonly unknown[];
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const ask = useServerFn(askQuestion);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => ask({ data: { productId, question: text } }),
    onSuccess: () => {
      toast.success("Question submitted");
      qc.invalidateQueries({ queryKey });
      setOpen(false);
      setText("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to submit"),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border-2 border-gold px-4 py-2 text-sm font-bold text-gold hover:bg-[var(--accent)]"
      >
        <MessageCircleQuestion size={14} /> Ask a Question
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-lg border border-line bg-white p-4"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="What would you like to know about this product?"
        className="w-full rounded-md border border-line px-3 py-2 text-sm"
      />
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={() => setOpen(false)}
          className="rounded-full px-4 py-2 text-sm font-semibold text-mute hover:text-ink"
        >
          Cancel
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending || text.trim().length < 4}
          className="rounded-full bg-gold px-5 py-2 text-sm font-bold text-navy disabled:opacity-50"
        >
          {m.isPending ? "Sending…" : "Submit question"}
        </button>
      </div>
    </motion.div>
  );
}
