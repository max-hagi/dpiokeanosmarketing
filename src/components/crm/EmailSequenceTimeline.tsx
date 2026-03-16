import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Mail, Pause, Zap, Edit3, Play, Eye, MessageSquare, X, CheckCircle, Send, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import {
  mapEmailStatus, statusDisplay, getRelativeSendTime, getExactTime,
  sequenceTypeLabels, type EmailDisplayStatus,
} from "./emailUtils";
import LeadStagePill from "./LeadStagePill";

interface Message {
  id: string;
  subject: string;
  body: string;
  status: string;
  message_number: number;
  scheduled_at: string | null;
  sent_at: string | null;
  responded_at: string | null;
  personalization_tags: any;
  sequence_id: string;
  lead_id: string;
}

interface Sequence {
  id: string;
  sequence_type: string;
  status: string;
  lead_id: string;
}

interface Props {
  messages: Message[];
  sequence: Sequence | null;
  leadName: string;
  leadStage: string;
}

export default function EmailSequenceTimeline({ messages, sequence, leadName, leadStage }: Props) {
  const queryClient = useQueryClient();
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [fastTrackMsgId, setFastTrackMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [pauseReason, setPauseReason] = useState("");
  const [replyBannerDismissed, setReplyBannerDismissed] = useState(false);

  const sequenceStatus = sequence?.status;
  const seqLabel = sequence ? sequenceTypeLabels[sequence.sequence_type] || `Sequence ${sequence.sequence_type}` : "No Sequence";

  // Stats
  const sent = messages.filter(m => m.status === "sent" || m.status === "responded").length;
  const scheduled = messages.filter(m => m.status === "pending" || m.status === "queued").length;
  const opened = 0; // No open tracking data available
  const respondedMsg = messages.find(m => m.responded_at);
  const nextUnsent = messages
    .filter(m => !m.sent_at && m.status !== "skipped" && m.status !== "sent" && m.scheduled_at)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())[0];

  // Mutations
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["follow-up-messages"] });
    queryClient.invalidateQueries({ queryKey: ["follow-up-sequences"] });
  };

  const pauseSequenceMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!sequence) return;
      const { error } = await supabase.from("follow_up_sequences").update({ status: "paused" }).eq("id", sequence.id);
      if (error) throw error;
      // Log the pause
      await supabase.from("audit_log").insert({
        action: "sequence_paused",
        details: { lead_name: leadName, reason: reason || "Manual pause", sequence_type: sequence.sequence_type },
      });
    },
    onSuccess: () => { invalidate(); toast.success("Sequence paused"); setPauseDialogOpen(false); },
  });

  const resumeSequenceMutation = useMutation({
    mutationFn: async () => {
      if (!sequence) return;
      const { error } = await supabase.from("follow_up_sequences").update({ status: "active" }).eq("id", sequence.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Sequence resumed"); },
  });

  const fastTrackMutation = useMutation({
    mutationFn: async (msgId: string) => {
      const { error } = await supabase.from("follow_up_messages").update({
        status: "sent", sent_at: new Date().toISOString(),
      }).eq("id", msgId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Email sent!"); setFastTrackMsgId(null); },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, subject, body }: { id: string; subject: string; body: string }) => {
      const { error } = await supabase.from("follow_up_messages").update({
        subject, body, status: "queued", // mark as edited-scheduled via status
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Email updated — will send as edited"); setEditingMsgId(null); },
  });

  const skipMutation = useMutation({
    mutationFn: async (msgId: string) => {
      const { error } = await supabase.from("follow_up_messages").update({ status: "skipped" }).eq("id", msgId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Email skipped"); },
  });

  const editingMsg = messages.find(m => m.id === editingMsgId);

  // Highlight personalization tags
  function renderBody(body: string) {
    return body.split(/(\[.*?\])/).map((part, i) =>
      part.startsWith("[") && part.endsWith("]") ? (
        <span key={i} className="bg-accent/20 text-accent rounded px-1 font-medium">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header: Sequence type + Stage */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{seqLabel}</span>
          </div>
          <LeadStagePill stage={leadStage} />
        </div>

        {/* Reply banner */}
        {respondedMsg && !replyBannerDismissed && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
            <MessageSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <span className="font-semibold">{leadName}</span> replied to your email
              {respondedMsg.responded_at && (
                <span className="text-muted-foreground"> on {new Date(respondedMsg.responded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              )}
              <span className="text-muted-foreground"> — sequence paused. Review their reply and resume or end the sequence manually.</span>
            </div>
            <button onClick={() => setReplyBannerDismissed(true)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Resume button when paused */}
        {sequenceStatus === "paused" && (
          <Button
            size="sm"
            className="gap-1.5 w-full"
            variant="outline"
            onClick={() => resumeSequenceMutation.mutate()}
            disabled={resumeSequenceMutation.isPending}
          >
            <Play className="h-3.5 w-3.5" /> Resume Sequence
          </Button>
        )}

        {/* Summary line */}
        <div className="text-xs text-muted-foreground">
          {sent} sent · {scheduled} scheduled
          {nextUnsent && ` · Next ${getRelativeSendTime(nextUnsent.scheduled_at, null).toLowerCase()}`}
          {sequenceStatus === "paused" && " · Sequence paused"}
          {sequenceStatus === "completed" && " · Sequence complete"}
        </div>

        {/* Timeline */}
        <div className="relative">
          {messages.map((msg, idx) => {
            const displayStatus = mapEmailStatus(msg.status, sequenceStatus);
            const sd = statusDisplay[displayStatus];
            const isSent = displayStatus === "sent" || displayStatus === "responded";
            const isNext = nextUnsent?.id === msg.id;
            const isSkipped = displayStatus === "skipped";
            const isFailed = displayStatus === "failed";
            const isPaused = displayStatus === "paused";
            const isLast = idx === messages.length - 1;

            return (
              <div key={msg.id} className="relative flex gap-3 group">
                {/* Vertical line */}
                {!isLast && (
                  <div className={`absolute left-[11px] top-6 bottom-0 w-px ${isSent ? "bg-border" : "bg-border/50 border-l border-dashed border-border"}`} />
                )}
                {/* Dot */}
                <div className={`relative z-10 mt-1 h-[22px] w-[22px] rounded-full flex items-center justify-center shrink-0 border-2 ${
                  isSent ? "bg-success/20 border-success" :
                  isNext ? "bg-primary/20 border-primary ring-2 ring-primary/20" :
                  isPaused ? "bg-warning/20 border-warning" :
                  isFailed ? "bg-destructive/20 border-destructive" :
                  isSkipped ? "bg-muted border-muted-foreground/30" :
                  "bg-muted border-border"
                }`}>
                  {isSent && <CheckCircle className="h-3 w-3 text-success" />}
                  {isNext && <Send className="h-3 w-3 text-primary" />}
                  {isPaused && <Pause className="h-3 w-3 text-warning" />}
                  {isFailed && <AlertTriangle className="h-3 w-3 text-destructive" />}
                  {isSkipped && <X className="h-3 w-3 text-muted-foreground" />}
                  {!isSent && !isNext && !isPaused && !isFailed && !isSkipped && <Mail className="h-3 w-3 text-muted-foreground" />}
                </div>

                {/* Content */}
                <div className={`flex-1 pb-4 ${!isSent && !isNext ? "opacity-70" : ""} ${isNext ? "" : ""}`}>
                  <div className={`rounded-lg border p-3 transition-all ${
                    isNext ? "border-primary/40 bg-primary/5" :
                    isPaused ? "border-warning/30" :
                    isFailed ? "border-destructive/30" :
                    "border-border"
                  }`}>
                    {/* Row 1: Badge + Subject + Time */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${sd.bg} ${sd.color}`}>
                        {sd.label}
                      </span>
                      <span className={`text-sm font-medium flex-1 truncate ${isSkipped ? "line-through text-muted-foreground" : ""}`}>
                        {msg.subject}
                      </span>
                      {/* Reply / open icons */}
                      {msg.responded_at && <MessageSquare className="h-3.5 w-3.5 text-primary" />}
                    </div>

                    {/* Row 2: Timing */}
                    <div className="mt-1 flex items-center gap-1.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`text-xs cursor-default ${
                            isFailed || (msg.scheduled_at && !msg.sent_at && new Date(msg.scheduled_at) < new Date()) ? "text-destructive font-semibold" : "text-muted-foreground"
                          }`}>
                            {getRelativeSendTime(msg.scheduled_at, msg.sent_at)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {msg.sent_at ? getExactTime(msg.sent_at) : getExactTime(msg.scheduled_at)}
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Action buttons — visible on hover (always on mobile) */}
                    {!isSent && !isSkipped && msg.status !== "responded" && (
                      <div className="mt-2 flex flex-wrap gap-1.5 opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 max-sm:opacity-100 transition-opacity">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] gap-1 text-warning border-warning/30 hover:bg-warning/10"
                          onClick={(e) => { e.stopPropagation(); setPauseDialogOpen(true); }}
                        >
                          <Pause className="h-3 w-3" /> Pause
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] gap-1 text-success border-success/30 hover:bg-success/10"
                          onClick={(e) => { e.stopPropagation(); setFastTrackMsgId(msg.id); }}
                        >
                          <Zap className="h-3 w-3" /> Fast-Track
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingMsgId(msg.id);
                            setEditSubject(msg.subject);
                            setEditBody(msg.body);
                          }}
                        >
                          <Edit3 className="h-3 w-3" /> Edit
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Inline Editor */}
        {editingMsg && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Edit Email — Message {editingMsg.message_number}</h4>
              <button onClick={() => setEditingMsgId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Subject</label>
              <Input value={editSubject} onChange={e => setEditSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Body</label>
              <Textarea
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                rows={8}
                className="font-sans text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Personalization tags like <span className="bg-accent/20 text-accent rounded px-0.5">[Lead Name]</span> are highlighted. You can edit their values for this lead only.</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="gap-1"
                onClick={() => editMutation.mutate({ id: editingMsg.id, subject: editSubject, body: editBody })}
                disabled={editMutation.isPending}
              >
                <CheckCircle className="h-3.5 w-3.5" /> Save Changes
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditingMsgId(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Pause Dialog */}
        <AlertDialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Pause sequence for {leadName}?</AlertDialogTitle>
              <AlertDialogDescription>
                All remaining emails will be paused. You can resume anytime — the sequence will pick up from the next scheduled email.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1 py-2">
              <label className="text-xs font-medium text-muted-foreground">Reason (optional)</label>
              <Select value={pauseReason} onValueChange={setPauseReason}>
                <SelectTrigger><SelectValue placeholder="Select a reason..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lead requested pause">Lead requested pause</SelectItem>
                  <SelectItem value="Waiting on info">Waiting on info</SelectItem>
                  <SelectItem value="In active conversation">In active conversation</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-warning text-warning-foreground hover:bg-warning/90"
                onClick={() => pauseSequenceMutation.mutate(pauseReason)}
              >
                Pause Sequence
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Fast-Track Confirmation */}
        <AlertDialog open={!!fastTrackMsgId} onOpenChange={open => { if (!open) setFastTrackMsgId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send this email to {leadName} right now?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone. The next email in the sequence will remain on its original schedule.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => fastTrackMsgId && fastTrackMutation.mutate(fastTrackMsgId)}>
                Send Now
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
