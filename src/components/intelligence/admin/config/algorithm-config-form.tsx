'use client';

/**
 * Algorithm Configuration Form Component
 * 
 * Form with sliders and inputs for algorithm parameters
 * Task: 11.4.2
 */

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { AlgorithmConfig } from './algorithm-config-content';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AlgorithmConfigFormProps {
  config: AlgorithmConfig;
  onChange: (config: AlgorithmConfig) => void;
  disabled?: boolean;
}

export function AlgorithmConfigForm({ config, onChange, disabled }: AlgorithmConfigFormProps) {
  function handleChange(key: keyof AlgorithmConfig, value: number) {
    // Validate weights sum to 100
    if (key === 'recommendationCollaborativeWeight') {
      onChange({
        ...config,
        [key]: value,
        recommendationContentWeight: 100 - value,
      });
    } else if (key === 'recommendationContentWeight') {
      onChange({
        ...config,
        [key]: value,
        recommendationCollaborativeWeight: 100 - value,
      });
    } else {
      onChange({
        ...config,
        [key]: value,
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Prediction Similarity Threshold */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="similarity-threshold">
            Prediction Similarity Threshold
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Minimum similarity score (0-100) required for historical auctions to be included in predictions.
                  Higher values = more strict matching, fewer similar auctions.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-4">
          <Slider
            id="similarity-threshold"
            min={0}
            max={100}
            step={5}
            value={[config.predictionSimilarityThreshold]}
            onValueChange={([value]) => handleChange('predictionSimilarityThreshold', value)}
            disabled={disabled}
            className="flex-1"
          />
          <Input
            type="number"
            value={config.predictionSimilarityThreshold}
            onChange={(e) => handleChange('predictionSimilarityThreshold', parseFloat(e.target.value))}
            disabled={disabled}
            className="w-20"
            min={0}
            max={100}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Current: {config.predictionSimilarityThreshold} (Default: 60)
        </p>
      </div>

      {/* Time Decay Months */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="time-decay">
            Time Decay Period (Months)
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Number of months for exponential time decay. Recent auctions are weighted higher.
                  Lower values = faster decay, more emphasis on recent data.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-4">
          <Slider
            id="time-decay"
            min={1}
            max={24}
            step={1}
            value={[config.timeDecayMonths]}
            onValueChange={([value]) => handleChange('timeDecayMonths', value)}
            disabled={disabled}
            className="flex-1"
          />
          <Input
            type="number"
            value={config.timeDecayMonths}
            onChange={(e) => handleChange('timeDecayMonths', parseFloat(e.target.value))}
            disabled={disabled}
            className="w-20"
            min={1}
            max={24}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Current: {config.timeDecayMonths} months (Default: 6)
        </p>
      </div>

      {/* Confidence Base */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="confidence-base">
            Confidence Base Score
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Base confidence score (0.5-1.0) for predictions with good data quality.
                  This is multiplied by sample size and recency factors.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-4">
          <Slider
            id="confidence-base"
            min={0.5}
            max={1.0}
            step={0.05}
            value={[config.confidenceBase]}
            onValueChange={([value]) => handleChange('confidenceBase', value)}
            disabled={disabled}
            className="flex-1"
          />
          <Input
            type="number"
            value={config.confidenceBase}
            onChange={(e) => handleChange('confidenceBase', parseFloat(e.target.value))}
            disabled={disabled}
            className="w-20"
            min={0.5}
            max={1.0}
            step={0.05}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Current: {config.confidenceBase.toFixed(2)} (Default: 0.85)
        </p>
      </div>

      {/* Recommendation Weights */}
      <div className="space-y-4 p-4 border rounded-lg">
        <h3 className="font-medium">Recommendation Algorithm Weights</h3>
        
        {/* Collaborative Weight */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="collab-weight">
              Collaborative Filtering Weight
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Weight for collaborative filtering (item-item similarity based on vendor behavior).
                    Must sum to 100% with content-based weight.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              id="collab-weight"
              min={0}
              max={100}
              step={5}
              value={[config.recommendationCollaborativeWeight]}
              onValueChange={([value]) => handleChange('recommendationCollaborativeWeight', value)}
              disabled={disabled}
              className="flex-1"
            />
            <Input
              type="number"
              value={config.recommendationCollaborativeWeight}
              onChange={(e) => handleChange('recommendationCollaborativeWeight', parseFloat(e.target.value))}
              disabled={disabled}
              className="w-20"
              min={0}
              max={100}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Current: {config.recommendationCollaborativeWeight}% (Default: 60%)
          </p>
        </div>

        {/* Content Weight */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="content-weight">
              Content-Based Filtering Weight
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Weight for content-based filtering (attribute matching).
                    Automatically adjusted to maintain 100% total.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              id="content-weight"
              min={0}
              max={100}
              step={5}
              value={[config.recommendationContentWeight]}
              onValueChange={([value]) => handleChange('recommendationContentWeight', value)}
              disabled={disabled}
              className="flex-1"
            />
            <Input
              type="number"
              value={config.recommendationContentWeight}
              onChange={(e) => handleChange('recommendationContentWeight', parseFloat(e.target.value))}
              disabled={disabled}
              className="w-20"
              min={0}
              max={100}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Current: {config.recommendationContentWeight}% (Default: 40%)
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          Total: {config.recommendationCollaborativeWeight + config.recommendationContentWeight}%
          {config.recommendationCollaborativeWeight + config.recommendationContentWeight !== 100 && (
            <span className="text-destructive ml-2">⚠ Must equal 100%</span>
          )}
        </p>
      </div>

      {/* Min Match Score */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="min-match-score">
            Minimum Match Score
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Minimum match score (0-100) for recommendations to be shown to vendors.
                  Higher values = fewer but more relevant recommendations.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-4">
          <Slider
            id="min-match-score"
            min={0}
            max={100}
            step={5}
            value={[config.minMatchScore]}
            onValueChange={([value]) => handleChange('minMatchScore', value)}
            disabled={disabled}
            className="flex-1"
          />
          <Input
            type="number"
            value={config.minMatchScore}
            onChange={(e) => handleChange('minMatchScore', parseFloat(e.target.value))}
            disabled={disabled}
            className="w-20"
            min={0}
            max={100}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Current: {config.minMatchScore} (Default: 30)
        </p>
      </div>

      {/* Cold Start Bid Threshold */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="cold-start-threshold">
            Cold Start Bid Threshold
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Minimum number of bids required before using collaborative filtering.
                  Below this threshold, content-based filtering is used.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-4">
          <Slider
            id="cold-start-threshold"
            min={0}
            max={10}
            step={1}
            value={[config.coldStartBidThreshold]}
            onValueChange={([value]) => handleChange('coldStartBidThreshold', value)}
            disabled={disabled}
            className="flex-1"
          />
          <Input
            type="number"
            value={config.coldStartBidThreshold}
            onChange={(e) => handleChange('coldStartBidThreshold', parseFloat(e.target.value))}
            disabled={disabled}
            className="w-20"
            min={0}
            max={10}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Current: {config.coldStartBidThreshold} bids (Default: 3)
        </p>
      </div>
    </div>
  );
}
