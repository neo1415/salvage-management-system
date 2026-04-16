"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ConfigChangeConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  changes: Array<{
    parameter: string;
    oldValue: number;
    newValue: number;
  }>;
}

export function ConfigChangeConfirmationModal({
  open,
  onOpenChange,
  onConfirm,
  changes,
}: ConfigChangeConfirmationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Confirm Configuration Changes
          </DialogTitle>
          <DialogDescription>
            You are about to modify algorithm parameters. This will affect all
            future predictions and recommendations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-4">
          <p className="text-sm font-medium text-gray-700">
            The following parameters will be changed:
          </p>
          {changes.map((change, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <span className="text-sm font-medium">{change.parameter}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {change.oldValue}
                </span>
                <span className="text-gray-400">→</span>
                <span className="text-sm font-semibold text-blue-600">
                  {change.newValue}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Warning:</strong> Changes will take effect immediately and
            cannot be undone. Previous configuration will be saved in history.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Confirm Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
