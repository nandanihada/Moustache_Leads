/**
 * Traffic Source Display Component
 * 
 * Displays traffic sources in three sections: Allowed, Risky, Disallowed.
 * Supports both read-only display and editable mode with overrides.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Edit2, 
  Save,
  Info
} from 'lucide-react';
import {
  TrafficSourceRules,
  getDefaultRulesForCategory,
  ALL_TRAFFIC_SOURCES,
  generateTrafficSources,
} from '@/services/trafficSourceApi';

interface TrafficSourceDisplayProps {
  category: string;
  country?: string;
  initialRules?: TrafficSourceRules;
  editable?: boolean;
  onRulesChange?: (rules: TrafficSourceRules, hasOverrides: boolean) => void;
  compact?: boolean;
}

export const TrafficSourceDisplay: React.FC<TrafficSourceDisplayProps> = ({
  category,
  country,
  initialRules,
  editable = false,
  onRulesChange,
  compact = false,
}) => {
  const [rules, setRules] = useState<TrafficSourceRules>(
    initialRules || getDefaultRulesForCategory(category)
  );
  const [isEditing, setIsEditing] = useState(false);
  const [hasOverrides, setHasOverrides] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch rules when category changes
  useEffect(() => {
    if (!initialRules) {
      fetchRules();
    }
  }, [category, country]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await generateTrafficSources({
        category,
        country,
      });
      setRules(response.rules);
      setHasOverrides(response.has_overrides);
    } catch (error) {
      console.error('Failed to fetch traffic rules:', error);
      // Fallback to client-side defaults
      setRules(getDefaultRulesForCategory(category));
    } finally {
      setLoading(false);
    }
  };

  const resetToDefaults = useCallback(() => {
    const defaults = getDefaultRulesForCategory(category);
    setRules(defaults);
    setHasOverrides(false);
    onRulesChange?.(defaults, false);
  }, [category, onRulesChange]);

  const moveSource = (source: string, from: keyof TrafficSourceRules, to: keyof TrafficSourceRules) => {
    if (from === to) return;

    const newRules = {
      allowed: [...rules.allowed],
      risky: [...rules.risky],
      disallowed: [...rules.disallowed],
    };

    // Remove from source list
    newRules[from] = newRules[from].filter(s => s !== source);
    
    // Add to target list if not already there
    if (!newRules[to].includes(source)) {
      newRules[to].push(source);
    }

    setRules(newRules);
    setHasOverrides(true);
    onRulesChange?.(newRules, true);
  };

  const renderSourceBadge = (
    source: string, 
    type: 'allowed' | 'risky' | 'disallowed',
    showActions: boolean = false
  ) => {
    const variants = {
      allowed: 'default' as const,
      risky: 'secondary' as const,
      disallowed: 'destructive' as const,
    };

    const colors = {
      allowed: 'bg-green-100 text-green-800 hover:bg-green-200 border-green-300',
      risky: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-300',
      disallowed: 'bg-red-100 text-red-800 hover:bg-red-200 border-red-300',
    };

    return (
      <TooltipProvider key={source}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={variants[type]}
              className={`${colors[type]} cursor-pointer transition-all ${
                showActions ? 'pr-1' : ''
              }`}
            >
              {source}
              {showActions && isEditing && (
                <span className="ml-1 flex gap-0.5">
                  {type !== 'allowed' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveSource(source, type, 'allowed');
                      }}
                      className="p-0.5 hover:bg-green-300 rounded"
                      title="Move to Allowed"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                    </button>
                  )}
                  {type !== 'risky' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveSource(source, type, 'risky');
                      }}
                      className="p-0.5 hover:bg-yellow-300 rounded"
                      title="Move to Risky"
                    >
                      <AlertTriangle className="h-3 w-3" />
                    </button>
                  )}
                  {type !== 'disallowed' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveSource(source, type, 'disallowed');
                      }}
                      className="p-0.5 hover:bg-red-300 rounded"
                      title="Move to Disallowed"
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  )}
                </span>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {type === 'allowed' && 'This traffic source is allowed for this offer category'}
              {type === 'risky' && 'This traffic source requires caution/monitoring'}
              {type === 'disallowed' && 'This traffic source is not permitted'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium">Allowed:</span>
          <div className="flex flex-wrap gap-1">
            {rules.allowed.slice(0, 5).map(source => (
              <Badge key={source} variant="outline" className="bg-green-50 text-green-700 text-xs">
                {source}
              </Badge>
            ))}
            {rules.allowed.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{rules.allowed.length - 5} more
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <span className="text-sm font-medium">Risky:</span>
          <div className="flex flex-wrap gap-1">
            {rules.risky.slice(0, 3).map(source => (
              <Badge key={source} variant="outline" className="bg-yellow-50 text-yellow-700 text-xs">
                {source}
              </Badge>
            ))}
            {rules.risky.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{rules.risky.length - 3} more
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-600" />
          <span className="text-sm font-medium">Disallowed:</span>
          <div className="flex flex-wrap gap-1">
            {rules.disallowed.slice(0, 3).map(source => (
              <Badge key={source} variant="outline" className="bg-red-50 text-red-700 text-xs">
                {source}
              </Badge>
            ))}
            {rules.disallowed.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{rules.disallowed.length - 3} more
              </Badge>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Traffic Sources
              {hasOverrides && (
                <Badge variant="outline" className="text-xs">
                  Custom
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Auto-generated based on {category} category
              {country && ` (${country})`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {editable && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? (
                    <>
                      <Save className="h-4 w-4 mr-1" />
                      Done
                    </>
                  ) : (
                    <>
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </>
                  )}
                </Button>
                {hasOverrides && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetToDefaults}
                    title="Reset to category defaults"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Allowed Traffic Sources */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <Label className="text-sm font-semibold text-green-700">
                  Allowed ({rules.allowed.length})
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Traffic sources that are safe and recommended for this category</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-green-50/50">
                {rules.allowed.length > 0 ? (
                  rules.allowed.map(source => renderSourceBadge(source, 'allowed', editable))
                ) : (
                  <span className="text-sm text-muted-foreground">No allowed sources</span>
                )}
              </div>
            </div>

            {/* Risky Traffic Sources */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <Label className="text-sm font-semibold text-yellow-700">
                  Risky ({rules.risky.length})
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Traffic sources that require caution and monitoring</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-yellow-50/50">
                {rules.risky.length > 0 ? (
                  rules.risky.map(source => renderSourceBadge(source, 'risky', editable))
                ) : (
                  <span className="text-sm text-muted-foreground">No risky sources</span>
                )}
              </div>
            </div>

            {/* Disallowed Traffic Sources */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <Label className="text-sm font-semibold text-red-700">
                  Disallowed ({rules.disallowed.length})
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Traffic sources that are not permitted for this category</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-red-50/50">
                {rules.disallowed.length > 0 ? (
                  rules.disallowed.map(source => renderSourceBadge(source, 'disallowed', editable))
                ) : (
                  <span className="text-sm text-muted-foreground">No disallowed sources</span>
                )}
              </div>
            </div>

            {/* Info about auto-generation */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Traffic sources are automatically generated based on the offer category.
                {editable && ' Click "Edit" to customize these rules. Overrides take precedence over defaults.'}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TrafficSourceDisplay;
