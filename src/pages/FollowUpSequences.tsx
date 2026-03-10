import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Mail, Clock, Send, SkipForward, XCircle, Loader2,
  AlertCircle, CheckCircle, Eye, Edit3, ArrowLeft, Calendar
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

const sequenceLabels: Record<string, { label: string; color: string }> = {
  A: { label: "Qualified Lead", color: "text-success" },
  B: { label: "Nurture", color: "text-warning" },
  C: { label: "Budget Recovery", color: "text-primary" },
  D: { label: "Location Recovery", color: "text-accent" },
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-muted-foreground", bg: "bg-muted/50" },
  queued: { label: "Queued", color: "text-warning", bg: "bg-warning/10" },
  sent: { label: "Sent", color: "text-success", bg: "bg-success/10" },
  responded: { label: "Responded", color: "text-primary", bg: "bg-primary/10" },
  skipped: { label: "Skipped", color: "text-muted-foreground", bg: "bg-muted/30" },
};

export default function FollowUpSequences() {
  const queryClient = useQueryClient();
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  // Fetch all sequences with lead names
  const { data: sequences, isLoading } = useQuery({
    queryKey: ["follow-up-sequences"],
    queryFn: async () => {
      const { data: seqs, error } = await supabase
        .from("follow_up_sequences")
        .select("*, leads(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return seqs;
    },
  });

  // Fetch all messages
  const { data: allMessages } = useQuery({
    queryKey: ["follow-up-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follow_up_messages")
        .select("*")
        .order("message_number", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Subscribe to realtime updates for response flagging
  useEffect(() => {
    const channel = supabase
      .channel("follow-up-responses")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "follow_up_messages" }, (payload) => {
        if ((payload.new as any).responded_at && !(payload.old as any).responded_at) {
          toast.info("A lead responded to a follow-up email! Sequence paused.", { duration: 8000 });
        }
        queryClient.invalidateQueries({ queryKey: ["follow-up-messages"] });
        queryClient.invalidateQueries({ queryKey: ["follow-up-sequences"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const selectedMessage = allMessages?.find(m => m.id === selectedMessageId);

  const updateMessageMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("follow_up_messages").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-up-messages"] });
      toast.success("Message updated!");
      setIsEditing(false);
    },
  });

  const updateSequenceMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("follow_up_sequences").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-up-sequences"] });
      toast.success("Sequence updated!");
    },
  });

  const sendNowMutation = useMutation({
    mutationFn: async (msgId: string) => {
      const { error } = await supabase.from("follow_up_messages").update({
        status: "sent",
        sent_at: new Date().toISOString(),
      }).eq("id", msgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-up-messages"] });
      toast.success("Message marked as sent!");
    },
  });

  // Highlight personalization tags in body text
  function highlightPersonalization(body: string, tags: any[]): JSX.Element {
    if (!tags || tags.length === 0) return <span>{body}</span>;
    // Simple approach: highlight known patterns
    let result = body;
    const tagList = Array.isArray(tags) ? tags : [];
    return (
      <span>
        {result.split(/(\[.*?\])/).map((part, i) =>
          part.startsWith("[") && part.endsWith("]") ? (
            <span key={i} className="bg-accent/20 text-accent rounded px-1 font-medium">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Follow-Up Sequences</h1>
        <p className="text-muted-foreground mt-1">Agent 7 — Personalized follow-up communications</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: Sequence list */}
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <Loader2 className="h-6 w-6 text-primary mx-auto animate-spin" />
            </div>
          ) : sequences && sequences.length > 0 ? (
            sequences.map((seq: any) => {
              const seqMessages = allMessages?.filter(m => m.sequence_id === seq.id) || [];
              const seqConfig = sequenceLabels[seq.sequence_type] || { label: seq.sequence_type, color: "text-foreground" };
              const hasResponse = seqMessages.some(m => m.responded_at);

              return (
                <div key={seq.id} className={`glass-card rounded-2xl p-5 space-y-3 ${hasResponse ? "ring-2 ring-destructive ring-offset-2 ring-offset-background" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${seqConfig.color}`}>{seqConfig.label}</span>
                        <span className="text-xs text-muted-foreground font-mono">Seq {seq.sequence_type}</span>
                        {hasResponse && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-bold animate-pulse">
                            <AlertCircle className="h-3 w-3" /> RESPONDED
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium mt-0.5">{(seq.leads as any)?.full_name || "Unknown"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        seq.status === "active" ? "bg-success/10 text-success" :
                        seq.status === "paused" ? "bg-warning/10 text-warning" :
                        seq.status === "completed" ? "bg-muted text-muted-foreground" :
                        "bg-destructive/10 text-destructive"
                      }`}>{seq.status}</span>
                    </div>
                  </div>

                  {/* Edit before sending toggle */}
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">Review before sending</label>
                    <Switch
                      checked={seq.edit_before_sending || false}
                      onCheckedChange={v => updateSequenceMutation.mutate({ id: seq.id, updates: { edit_before_sending: v } })}
                    />
                  </div>

                  {/* Messages timeline */}
                  <div className="space-y-2">
                    {seqMessages.map((msg: any) => {
                      const sc = statusConfig[msg.status] || statusConfig.pending;
                      return (
                        <button
                          key={msg.id}
                          onClick={() => {
                            setSelectedMessageId(msg.id);
                            setEditingBody(msg.body);
                            setIsEditing(false);
                          }}
                          className={`w-full text-left rounded-lg border border-border p-3 transition-all hover:bg-muted/30 ${
                            selectedMessageId === msg.id ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
                          } ${msg.responded_at ? "border-destructive/50" : ""}`}
                        >
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs font-medium flex-1 truncate">Msg {msg.message_number}: {msg.subject}</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${sc.bg} ${sc.color}`}>{sc.label}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {msg.scheduled_at ? format(new Date(msg.scheduled_at), "MMM d, h:mm a") : "Not scheduled"}
                            {msg.sent_at && <span className="text-success">• Sent {format(new Date(msg.sent_at), "MMM d")}</span>}
                            {msg.responded_at && <span className="text-destructive font-bold">• Responded!</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Sequence controls */}
                  <div className="flex gap-2">
                    {seq.status === "active" && (
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => updateSequenceMutation.mutate({ id: seq.id, updates: { status: "paused" } })}>
                        Pause
                      </Button>
                    )}
                    {seq.status === "paused" && (
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => updateSequenceMutation.mutate({ id: seq.id, updates: { status: "active" } })}>
                        Resume
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="text-xs text-destructive" onClick={() => updateSequenceMutation.mutate({ id: seq.id, updates: { status: "cancelled" } })}>
                      End Sequence
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="glass-card rounded-2xl p-16 text-center">
              <div className="flex justify-center mb-4">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                  <Mail className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
              <p className="text-muted-foreground mb-2">No follow-up sequences yet.</p>
              <p className="text-xs text-muted-foreground">Sequences are created automatically when the CRM Action Agent runs.</p>
            </div>
          )}
        </div>

        {/* RIGHT: Email preview */}
        <div className="lg:col-span-3">
          {selectedMessage ? (
            <div className="glass-card rounded-2xl p-6 space-y-5 sticky top-6">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">Email Preview</h2>
                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setIsEditing(true)}>
                      <Edit3 className="h-3.5 w-3.5" /> Edit
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setIsEditing(false)}>
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </Button>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Subject</label>
                <p className="text-sm font-medium">{selectedMessage.subject}</p>
              </div>

              {/* Body */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Body</label>
                {isEditing ? (
                  <Textarea
                    value={editingBody}
                    onChange={e => setEditingBody(e.target.value)}
                    rows={12}
                    className="font-sans text-sm"
                  />
                ) : (
                  <div className="rounded-xl border border-border bg-background p-4 text-sm leading-relaxed whitespace-pre-wrap">
                    {highlightPersonalization(selectedMessage.body, selectedMessage.personalization_tags as any[])}
                  </div>
                )}
              </div>

              {/* Personalization tags */}
              {selectedMessage.personalization_tags && (selectedMessage.personalization_tags as any[]).length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Personalization Used</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedMessage.personalization_tags as any[]).map((tag: string, i: number) => (
                      <span key={i} className="inline-flex items-center rounded-full bg-accent/10 text-accent px-2.5 py-0.5 text-[10px] font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                {isEditing && (
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => updateMessageMutation.mutate({ id: selectedMessage.id, updates: { body: editingBody } })}
                    disabled={updateMessageMutation.isPending}
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Save Changes
                  </Button>
                )}
                {selectedMessage.status !== "sent" && selectedMessage.status !== "skipped" && (
                  <>
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => sendNowMutation.mutate(selectedMessage.id)}
                      disabled={sendNowMutation.isPending}
                    >
                      <Send className="h-3.5 w-3.5" /> Send Now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => updateMessageMutation.mutate({
                        id: selectedMessage.id,
                        updates: { scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
                      })}
                    >
                      <Calendar className="h-3.5 w-3.5" /> Reschedule
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-muted-foreground"
                      onClick={() => updateMessageMutation.mutate({ id: selectedMessage.id, updates: { status: "skipped" } })}
                    >
                      <SkipForward className="h-3.5 w-3.5" /> Skip
                    </Button>
                  </>
                )}
              </div>

              {/* Status */}
              <div className="text-xs text-muted-foreground">
                {selectedMessage.sent_at && <p>Sent: {format(new Date(selectedMessage.sent_at), "MMM d, yyyy h:mm a")}</p>}
                {selectedMessage.responded_at && <p className="text-destructive font-semibold">Responded: {format(new Date(selectedMessage.responded_at), "MMM d, yyyy h:mm a")}</p>}
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-16 text-center">
              <Eye className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Select a message to preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
