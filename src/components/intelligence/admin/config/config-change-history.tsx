"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, User, RotateCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface ConfigChange {
  id: string;
  configKey: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
  description?: string;
}

export function ConfigChangeHistory() {
  const [history, setHistory] = useState<ConfigChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      setLoading(true);
      const response = await fetch("/api/intelligence/admin/config/history");
      
      if (!response.ok) {
        throw new Error("Failed to fetch history");
      }

      const data = await response.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error("Failed to load configuration history");
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(configId: string) {
    if (!confirm("Are you sure you want to restore this configuration?")) {
      return;
    }

    try {
      const response = await fetch(`/api/intelligence/admin/config/restore/${configId}`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to restore configuration");
      }

      toast.success("Configuration restored successfully");
      // Reload the page to reflect changes
      window.location.reload();
    } catch (error) {
      console.error("Error restoring configuration:", error);
      toast.error("Failed to restore configuration");
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuration History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 text-center py-8">
            Loading history...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuration History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 text-center py-8">
            No configuration changes yet
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group changes by timestamp (within 1 minute)
  const groupedHistory: { [key: string]: ConfigChange[] } = {};
  history.forEach((change) => {
    const timestamp = new Date(change.changedAt).toISOString().slice(0, 16); // Group by minute
    if (!groupedHistory[timestamp]) {
      groupedHistory[timestamp] = [];
    }
    groupedHistory[timestamp].push(change);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(groupedHistory).map(([timestamp, changes]) => {
            const firstChange = changes[0];
            return (
              <div
                key={timestamp}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">{firstChange.changedBy}</span>
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDistanceToNow(new Date(firstChange.changedAt), {
                        addSuffix: true,
                      })}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestore(firstChange.id)}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restore
                  </Button>
                </div>

                <div className="space-y-2">
                  {changes.map((change, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700">
                        {change.configKey.replace(/\./g, " › ")}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{change.oldValue}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium text-blue-600">
                          {change.newValue}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {firstChange.description && (
                  <p className="text-sm text-gray-600 mt-2 italic">
                    {firstChange.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
