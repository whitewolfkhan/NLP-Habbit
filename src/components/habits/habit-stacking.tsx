'use client';

import { useState, useEffect } from 'react';
import { Layers, Plus, X, Lightbulb, Loader2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StackSuggestion {
  triggerHabit: string;
  linkedHabit: string;
  strength: number;
  tip: string;
}

interface HabitStack {
  id: string;
  triggerHabit: string;
  linkedHabit: string;
  successRate: number;
}

interface HabitStacksData {
  stacks: HabitStack[];
  suggestions: StackSuggestion[];
}

interface HabitStackingProps {
  className?: string;
}

export function HabitStacking({ className }: HabitStackingProps) {
  const [data, setData] = useState<HabitStacksData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStacks();
  }, []);

  const fetchStacks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/habit-stacks');
      if (res.ok) {
        const result = await res.json();
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch habit stacks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createStack = async (triggerHabit: string, linkedHabit: string) => {
    try {
      const res = await fetch('/api/habit-stacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerHabit, linkedHabit }),
      });
      
      if (res.ok) {
        fetchStacks();
      }
    } catch (error) {
      console.error('Failed to create stack:', error);
    }
  };

  const deleteStack = async (id: string) => {
    try {
      const res = await fetch(`/api/habit-stacks?id=${id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        fetchStacks();
      }
    } catch (error) {
      console.error('Failed to delete stack:', error);
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

  const hasContent = (data?.stacks?.length || 0) > 0 || (data?.suggestions?.length || 0) > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-teal-500" />
          <CardTitle className="text-base">Habit Stacking</CardTitle>
        </div>
        <CardDescription>Stack habits together for better consistency</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active Stacks */}
        {data?.stacks && data.stacks.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Active Stacks</h4>
            <ScrollArea className="h-[80px]">
              <div className="space-y-2">
                {data.stacks.map((stack) => (
                  <div
                    key={stack.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{stack.triggerHabit}</Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge variant="secondary">{stack.linkedHabit}</Badge>
                      {stack.successRate > 0 && (
                        <Badge variant="outline" className="text-green-600">
                          {stack.successRate}% success
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => deleteStack(stack.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Suggestions */}
        {data?.suggestions && data.suggestions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              AI Suggestions
            </h4>
            <ScrollArea className="h-[150px]">
              <div className="space-y-2">
                {data.suggestions.map((suggestion, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20 border border-teal-200 dark:border-teal-900"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline">{suggestion.triggerHabit}</Badge>
                        <ArrowRight className="h-3 w-3 text-teal-500" />
                        <Badge variant="secondary">{suggestion.linkedHabit}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {suggestion.strength}% match
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => createStack(suggestion.triggerHabit, suggestion.linkedHabit)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{suggestion.tip}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Empty state */}
        {(!data?.suggestions || data.suggestions.length === 0) && (!data?.stacks || data.stacks.length === 0) && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Log more positive habits to get stacking suggestions!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
