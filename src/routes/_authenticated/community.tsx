import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { EyeOff, Eye, Trash2, Flag, Send, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/community")({
  component: CommunityPage,
});

const EMOJIS = ["👍", "❤️", "🔥", "😂", "😮"];

type Post = {
  id: string; user_id: string; body: string; hidden: boolean; created_at: string;
  author?: string;
};
type Reply = { id: string; post_id: string; user_id: string; body: string; hidden: boolean; created_at: string; author?: string };
type Reaction = { post_id: string; user_id: string; emoji: string };

function CommunityPage() {
  const { t, lang } = useI18n();
  const { isAdmin } = useAdmin();
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  const [newPost, setNewPost] = useState("");
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null)); }, []);

  const { data: posts = [] } = useQuery({
    queryKey: ["community-posts"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase.from("community_posts")
        .select("id,user_id,body,hidden,created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Post[];
    },
  });

  const { data: replies = [] } = useQuery({
    queryKey: ["community-replies", posts.map((p) => p.id).join(",")],
    enabled: posts.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("community_replies")
        .select("id,post_id,user_id,body,hidden,created_at")
        .in("post_id", posts.map((p) => p.id))
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Reply[];
    },
  });

  const { data: reactions = [] } = useQuery({
    queryKey: ["community-reactions", posts.map((p) => p.id).join(",")],
    enabled: posts.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("community_reactions")
        .select("post_id,user_id,emoji").in("post_id", posts.map((p) => p.id));
      if (error) throw error;
      return data as Reaction[];
    },
  });

  const { data: profileMap = {} } = useQuery({
    queryKey: ["profiles-map", posts.length, replies.length],
    enabled: posts.length > 0 || replies.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set([...posts.map((p) => p.user_id), ...replies.map((r) => r.user_id)]));
      if (!ids.length) return {} as Record<string, string>;
      const { data } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      return Object.fromEntries((data ?? []).map((p: any) => [p.id, p.full_name || "—"]));
    },
  });

  const reactionsByPost = useMemo(() => {
    const m: Record<string, Record<string, { count: number; mine: boolean }>> = {};
    for (const r of reactions) {
      m[r.post_id] ??= {};
      m[r.post_id][r.emoji] ??= { count: 0, mine: false };
      m[r.post_id][r.emoji].count++;
      if (r.user_id === uid) m[r.post_id][r.emoji].mine = true;
    }
    return m;
  }, [reactions, uid]);

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;
    const b = newPost.trim();
    if (b.length < 2) return;
    const { error } = await supabase.from("community_posts").insert({ user_id: uid, body: b });
    if (error) { toast.error(error.message); return; }
    setNewPost("");
    qc.invalidateQueries({ queryKey: ["community-posts"] });
  }

  async function submitReply(postId: string) {
    if (!uid) return;
    const b = replyText.trim();
    if (!b) return;
    const { error } = await supabase.from("community_replies").insert({ post_id: postId, user_id: uid, body: b });
    if (error) { toast.error(error.message); return; }
    setReplyText(""); setReplyOpen(null);
    qc.invalidateQueries({ queryKey: ["community-replies"] });
  }

  async function toggleReact(postId: string, emoji: string) {
    if (!uid) return;
    const mine = reactionsByPost[postId]?.[emoji]?.mine;
    if (mine) {
      await supabase.from("community_reactions").delete().eq("post_id", postId).eq("user_id", uid).eq("emoji", emoji);
    } else {
      await supabase.from("community_reactions").insert({ post_id: postId, user_id: uid, emoji });
    }
    qc.invalidateQueries({ queryKey: ["community-reactions"] });
  }

  async function report(targetType: "post" | "reply", targetId: string) {
    if (!uid) return;
    const reason = prompt(t("report_reason_prompt")) ?? "";
    const { error } = await supabase.from("community_reports").insert({
      reporter_id: uid, target_type: targetType, target_id: targetId, reason: reason.slice(0, 500),
    });
    if (error) { toast.error(error.message); return; }
    toast.success(t("reported"));
  }

  async function toggleHide(kind: "post" | "reply", id: string, hidden: boolean) {
    const table = kind === "post" ? "community_posts" : "community_replies";
    const { error } = await supabase.from(table).update({ hidden: !hidden }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: [kind === "post" ? "community-posts" : "community-replies"] });
  }

  async function del(kind: "post" | "reply", id: string) {
    if (!confirm(t("confirm_delete"))) return;
    const table = kind === "post" ? "community_posts" : "community_replies";
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: [kind === "post" ? "community-posts" : "community-replies"] });
  }

  const locale = lang === "ar" ? "ar-EG" : "en-GB";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("community")}</h1>
        <p className="text-sm text-muted-foreground">{t("community_hint")}</p>
      </div>

      <form onSubmit={submitPost} className="border rounded-xl bg-card p-4 space-y-2">
        <textarea
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-y"
          placeholder={t("share_thought")}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={newPost.trim().length < 2}>{t("post")}</Button>
        </div>
      </form>

      <div className="space-y-4">
        {posts.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">{t("no_posts_yet")}</p>
        )}
        {posts.map((p) => {
          const postReplies = replies.filter((r) => r.post_id === p.id);
          return (
            <div key={p.id} className={`border rounded-xl bg-card p-4 ${p.hidden ? "opacity-50" : ""}`}>
              <div className="flex justify-between items-start gap-2 mb-2">
                <div>
                  <p className="text-sm font-semibold">{(profileMap as any)[p.user_id] || "—"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString(locale)}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => report("post", p.id)} className="text-muted-foreground hover:text-destructive p-1" title={t("report")}>
                    <Flag className="h-3.5 w-3.5" />
                  </button>
                  {(isAdmin || p.user_id === uid) && (
                    <button onClick={() => del("post", p.id)} className="text-muted-foreground hover:text-destructive p-1" title={t("delete_product")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => toggleHide("post", p.id, p.hidden)} className="text-muted-foreground hover:text-foreground p-1" title={p.hidden ? "unhide" : "hide"}>
                      {p.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{p.body}</p>

              <div className="mt-3 flex flex-wrap gap-1">
                {EMOJIS.map((e) => {
                  const r = reactionsByPost[p.id]?.[e];
                  return (
                    <button key={e} onClick={() => toggleReact(p.id, e)}
                      className={`px-2 py-0.5 rounded-full border text-xs ${r?.mine ? "bg-primary/10 border-primary" : ""}`}>
                      {e} {r?.count ? <span className="ml-1">{r.count}</span> : null}
                    </button>
                  );
                })}
                <button onClick={() => { setReplyOpen(replyOpen === p.id ? null : p.id); setReplyText(""); }}
                  className="px-2 py-0.5 rounded-full border text-xs flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> {t("reply")} {postReplies.length ? `(${postReplies.length})` : ""}
                </button>
              </div>

              {postReplies.length > 0 && (
                <div className="mt-3 space-y-2 border-t pt-2">
                  {postReplies.map((r) => (
                    <div key={r.id} className={`text-sm bg-muted/50 rounded-md p-2 ${r.hidden ? "opacity-50" : ""}`}>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-xs font-semibold">{(profileMap as any)[r.user_id] || "—"}</p>
                          <p className="whitespace-pre-wrap">{r.body}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => report("reply", r.id)} className="text-muted-foreground hover:text-destructive p-1"><Flag className="h-3 w-3" /></button>
                          {(isAdmin || r.user_id === uid) && (
                            <button onClick={() => del("reply", r.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-3 w-3" /></button>
                          )}
                          {isAdmin && (
                            <button onClick={() => toggleHide("reply", r.id, r.hidden)} className="text-muted-foreground hover:text-foreground p-1">
                              {r.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {replyOpen === p.id && (
                <div className="mt-3 flex gap-2">
                  <input value={replyText} onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t("write_reply")} maxLength={2000}
                    className="flex-1 rounded-md border bg-background px-3 py-2 text-sm" />
                  <Button size="sm" onClick={() => submitReply(p.id)}><Send className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
