import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Button } from "./button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { reportBugAction } from "@/app/actions";
import { Player } from "@/types";
import { RefreshCw } from "lucide-react";

export function ReportBugDialog({
  isReportBugOpen,
  setIsReportBugOpen,
  authenticatedPlayer,
  gameId,
  sha,
}: {
  isReportBugOpen: boolean;
  setIsReportBugOpen: (isOpen: boolean) => void;
  authenticatedPlayer?: Player;
  gameId: string;
  sha: string | null;
}) {
  const [bugTitle, setBugTitle] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [isSubmittingBug, setIsSubmittingBug] = useState(false);

  const { toast } = useToast();

  const handleReportBug = async () => {
    if (!bugTitle.trim() || !bugDescription.trim()) return;
    setIsSubmittingBug(true);
    try {
      const result = await reportBugAction(
        bugTitle.trim(),
        bugDescription.trim(),
        authenticatedPlayer?.name || "Anonymous",
        gameId,
        sha
      );
      if (result.success && result.issueUrl) {
        toast({
          title: "Bug Report Submitted!",
          description: (
            <>
              Issue created:{" "}
              <a
                href={result.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                #{result.issueNumber}
              </a>
            </>
          ),
        });
        setIsReportBugOpen(false);
        setBugTitle("");
        setBugDescription("");
      } else {
        throw new Error(result.error || "An unknown error occurred.");
      }
    } catch (e: any) {
      toast({
        title: "Submission Failed",
        description: e.message || "Could not submit bug report.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingBug(false);
    }
  };

  return (
    <Dialog open={isReportBugOpen} onOpenChange={setIsReportBugOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
          <DialogDescription>
            Describe the bug you encountered. Please be as detailed as possible.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            value={bugTitle}
            onChange={(e) => setBugTitle(e.target.value)}
            placeholder="Bug title (e.g. Cannot play a valid word)"
            disabled={isSubmittingBug}
          />
          <Textarea
            value={bugDescription}
            onChange={(e) => setBugDescription(e.target.value)}
            placeholder="Describe the bug in detail..."
            disabled={isSubmittingBug}
            rows={5}
          />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setIsReportBugOpen(false)}
            disabled={isSubmittingBug}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReportBug}
            disabled={
              !bugTitle.trim() || !bugDescription.trim() || isSubmittingBug
            }
          >
            {isSubmittingBug ? (
              <RefreshCw className="animate-spin" />
            ) : (
              "Submit Bug Report"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
