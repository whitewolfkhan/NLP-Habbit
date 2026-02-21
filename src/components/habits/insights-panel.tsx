'use client';

import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, AlertTriangle, Trophy, Lightbulb, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Insight {
  type: 'prediction' | 'recommendation' | 'warning' | 'achievement';
  title: string;
  content: string;
  confidence?: number;
  category?: string;
  icon?: string;
}

interface InsightsPanelProps {
  className?: string;
}

export function InsightsPanel({ className }: InsightsPanelProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/insights');
      if (res.ok) {
        const data = await res.json();
        setInsights(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getInsightIcon = (type: string, customIcon?: string) => {
    if (customIcon) return <span className="text-lg">{customIcon}</span>;
    
    switch (type) {
      case 'prediction':
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case 'recommendation':
        return <Lightbulb className="h-4 w-4 text-amber-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'achievement':
        return <Trophy className="h-4 w-4 text-green-500" />;
      default:
        return <Sparkles className="h-4 w-4 text-purple-500" />;
    }
  };

  const getInsightBorderColor = (type: string) => {
    switch (type) {
      case 'prediction':
        return 'border-l-blue-500';
      case 'recommendation':
        return 'border-l-amber-500';
      case 'warning':
        return 'border-l-red-500';
      case 'achievement':
        return 'border-l-green-500';
      default:
        return 'border-l-purple-500';
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-base">AI Insights</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {insights.length} insights
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </Button>
          </div>
        </div>
        <CardDescription>Personalized predictions and recommendations</CardDescription>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <ScrollArea className="h-[250px]">
            {insights.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Log some habits to get personalized insights!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {insights.map((insight, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg bg-muted/50 border-l-4 ${getInsightBorderColor(insight.type)}`}
                  >
                    <div className="flex items-start gap-2">
                      {getInsightIcon(insight.type, insight.icon)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{insight.title}</span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {insight.type}
                          </Badge>
                          {insight.confidence && (
                            <Badge variant="secondary" className="text-xs">
                              {Math.round(insight.confidence * 100)}% confidence
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {insight.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}
