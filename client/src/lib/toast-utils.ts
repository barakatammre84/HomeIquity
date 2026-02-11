import { toast } from "@/hooks/use-toast";

interface ToastOptions {
  title: string;
  description?: string;
}

export function showSuccess({ title, description }: ToastOptions) {
  toast({ title, description });
}

export function showError({
  title = "Something went wrong",
  description = "Please try again or contact support if the problem persists.",
}: Partial<ToastOptions> = {}) {
  toast({ title, description, variant: "destructive" });
}

export function showMutationError(error: unknown, fallbackTitle?: string) {
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";
  toast({
    title: fallbackTitle || "Something went wrong",
    description: message,
    variant: "destructive",
  });
}
