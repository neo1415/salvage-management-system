'use client';

/**
 * Algorithm Configuration Content Component
 * 
 * Main content for algorithm configuration page
 * Tasks: 11.4.2-11.4.6
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AlgorithmConfigForm } from './algorithm-config-form';
import { PreviewImpactComparison } from './preview-impact-comparison';
import { ConfigChangeHistory } from './config-change-history';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export interface AlgorithmConfig {
  predictionSimilarityThreshold: number;
  timeDecayMonths: number;
  confidenceBase: number;
  recommendationCollaborativeWeight: number;
  recommendationContentWeight: number;
  minMatchScore: number;
  coldStartBidThreshold: number;
}

const DEFAULT_CONFIG: AlgorithmConfig = {
  predictionSimilarityThreshold: 60,
  timeDecayMonths: 6,
  confidenceBase: 0.85,
  recommendationCollaborativeWeight: 60,
  recommendationContentWeight: 40,
  minMatchScore: 30,
  coldStartBidThreshold: 3,
};

export function AlgorithmConfigContent() {
  const [currentConfig, setCurrentConfig] = useState<AlgorithmConfig>(DEFAULT_CONFIG);
  const [proposedConfig, setProposedConfig] = useState<AlgorithmConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchCurrentConfig();
  }, []);

  useEffect(() => {
    const changed = JSON.stringify(currentConfig) !== JSON.stringify(proposedConfig);
    setHasChanges(changed);
  }, [currentConfig, proposedConfig]);

  async function fetchCurrentConfig() {
    try {
      setLoading(true);
      const response = await fetch('/api/intelligence/admin/config');
      
      if (!response.ok) {
        throw new Error('Failed to fetch configuration');
      }

      const data = await response.json();
      
      // Map config keys to our structure
      const config: AlgorithmConfig = {
        predictionSimilarityThreshold: parseFloat(data.data.find((c: any) => c.configKey === 'prediction.similarity_threshold')?.configValue || '60'),
        timeDecayMonths: parseFloat(data.data.find((c: any) => c.configKey === 'prediction.time_decay_months')?.configValue || '6'),
        confidenceBase: parseFloat(data.data.find((c: any) => c.configKey === 'prediction.confidence_base')?.configValue || '0.85'),
        recommendationCollaborativeWeight: parseFloat(data.data.find((c: any) => c.configKey === 'recommendation.collaborative_weight')?.configValue || '60'),
        recommendationContentWeight: parseFloat(data.data.find((c: any) => c.configKey === 'recommendation.content_weight')?.configValue || '40'),
        minMatchScore: parseFloat(data.data.find((c: any) => c.configKey === 'recommendation.min_match_score')?.configValue || '30'),
        coldStartBidThreshold: parseFloat(data.data.find((c: any) => c.configKey === 'recommendation.cold_start_bid_threshold')?.configValue || '3'),
      };

      setCurrentConfig(config);
      setProposedConfig(config);
    } catch (error) {
      console.error('Error fetching config:', error);
      toast.error('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);

      // Save each config value
      const configUpdates = [
        { key: 'prediction.similarity_threshold', value: proposedConfig.predictionSimilarityThreshold, description: 'Minimum similarity score for historical matching' },
        { key: 'prediction.time_decay_months', value: proposedConfig.timeDecayMonths, description: 'Time decay period in months' },
        { key: 'prediction.confidence_base', value: proposedConfig.confidenceBase, description: 'Base confidence score' },
        { key: 'recommendation.collaborative_weight', value: proposedConfig.recommendationCollaborativeWeight, description: 'Collaborative filtering weight percentage' },
        { key: 'recommendation.content_weight', value: proposedConfig.recommendationContentWeight, description: 'Content-based filtering weight percentage' },
        { key: 'recommendation.min_match_score', value: proposedConfig.minMatchScore, description: 'Minimum match score threshold' },
        { key: 'recommendation.cold_start_bid_threshold', value: proposedConfig.coldStartBidThreshold, description: 'Minimum bids for collaborative filtering' },
      ];

      for (const update of configUpdates) {
        const response = await fetch('/api/intelligence/admin/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            configKey: update.key,
            configValue: update.value,
            description: update.description,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update ${update.key}`);
        }
      }

      setCurrentConfig(proposedConfig);
      setShowPreview(false);
      
      toast.success('Algorithm configuration updated successfully');

      // Refresh history
      await fetchCurrentConfig();
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (confirm('Are you sure you want to reset to default configuration? This cannot be undone.')) {
      try {
        setSaving(true);
        
        const response = await fetch('/api/intelligence/admin/config/reset', {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to reset configuration');
        }

        await fetchCurrentConfig();
        
        toast.success('Configuration reset to defaults');
      } catch (error) {
        console.error('Error resetting config:', error);
        toast.error('Failed to reset configuration');
      } finally {
        setSaving(false);
      }
    }
  }

  function handlePreview() {
    setShowPreview(true);
  }

  function handleCancelPreview() {
    setShowPreview(false);
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Warning Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Configuration Changes</AlertTitle>
        <AlertDescription>
          Changes to algorithm parameters will affect all future predictions and recommendations.
          Use the preview feature to estimate impact before saving.
        </AlertDescription>
      </Alert>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle>Algorithm Parameters</CardTitle>
          <CardDescription>
            Adjust parameters to optimize prediction accuracy and recommendation effectiveness
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlgorithmConfigForm
            config={proposedConfig}
            onChange={setProposedConfig}
            disabled={saving}
          />

          <div className="flex gap-4 mt-6">
            <Button
              onClick={handlePreview}
              disabled={!hasChanges || saving}
              variant="outline"
            >
              Preview Impact
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              onClick={() => setProposedConfig(currentConfig)}
              disabled={!hasChanges || saving}
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReset}
              disabled={saving}
              variant="destructive"
              className="ml-auto"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Impact Comparison */}
      {showPreview && (
        <PreviewImpactComparison
          currentConfig={currentConfig}
          proposedConfig={proposedConfig}
          onClose={handleCancelPreview}
          onConfirm={handleSave}
        />
      )}

      {/* Configuration Change History */}
      <ConfigChangeHistory />
    </div>
  );
}
