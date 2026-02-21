'use client';

import { useState, useEffect } from 'react';
import { Grid3X3, TrendingUp, Smile, Frown, Meh, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HeatmapData {
  type: string;
  daily: Array<{
    date: string;
    day: string;
    dayNum: string;
    month: string;
    score: number;
    count: number;
    mood: string;
    color: string;
    intensity: number;
  }>;
  hourly: Array<{
    hour: number;
    label: string;
    count: number;
    avgMood: number;
  }>;
  weekly: Array<{
    day: string;
    dayIndex: number;
    count: number;
    avgMood: number;
    positive: number;
    negative: number;
  }>;
  summary: {
    totalDays: number;
    averageMood: number;
    bestDay: any;
    worstDay: any;
  };
}

interface SentimentHeatmapProps {
  className?: string;
}

export function SentimentHeatmap({ className }: SentimentHeatmapProps) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewType, setViewType] = useState<'daily' | 'hourly' | 'weekly'>('daily');

  useEffect(() => {
    fetchHeatmap();
  }, []);

  const fetchHeatmap = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/heatmap?type=mood&range=30');
      if (res.ok) {
        const result = await res.json();
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch heatmap:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getMoodEmoji = (mood: string) => {
    const positiveMoods = ['happy', 'great', 'amazing', 'energized', 'good', 'motivated', 'proud', 'accomplished'];
    const negativeMoods = ['sad', 'guilty', 'ashamed', 'bad', 'angry', 'frustrated', 'stressed', 'anxious'];
    
    if (positiveMoods.includes(mood.toLowerCase())) return <Smile className="h-3 w-3 text-green-500" />;
    if (negativeMoods.includes(mood.toLowerCase())) return <Frown className="h-3 w-3 text-red-500" />;
    return <Meh className="h-3 w-3 text-gray-400" />;
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

  if (!data || !data.daily || data.daily.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-base">Mood Heatmap</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Log habits with moods to see your emotional patterns!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-base">Mood Heatmap</CardTitle>
          </div>
          {data.summary && (
            <Badge variant="outline" className="gap-1">
              <Smile className="h-3 w-3" />
              Avg: {data.summary.averageMood.toFixed(1)}/5
            </Badge>
          )}
        </div>
        <CardDescription>Emotional patterns over time</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={viewType} onValueChange={(v) => setViewType(v as any)}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="hourly">Hourly</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-3">
            <div className="grid grid-cols-7 gap-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div key={i} className="text-center text-xs text-muted-foreground font-medium">
                  {day}
                </div>
              ))}
              {data.daily.map((day, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-sm flex flex-col items-center justify-center text-xs cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                  style={{ backgroundColor: day.color, opacity: 0.3 + (day.intensity / 100) * 0.7 }}
                  title={`${day.date}: ${day.mood} (${day.score.toFixed(1)}/5, ${day.count} entries)`}
                >
                  <span className="font-medium">{day.dayNum}</span>
                </div>
              ))}
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Frown className="h-3 w-3" />
                <span>Bad</span>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <div
                    key={level}
                    className="w-4 h-4 rounded-sm"
                    style={{ backgroundColor: level <= 2 ? '#ef4444' : level === 3 ? '#6b7280' : '#22c55e', opacity: 0.2 + level * 0.2 }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                <span>Great</span>
                <Smile className="h-3 w-3" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="weekly" className="space-y-3">
            <div className="space-y-2">
              {data.weekly.map((day) => (
                <div key={day.dayIndex} className="flex items-center gap-3">
                  <span className="w-10 text-sm font-medium">{day.day}</span>
                  <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden flex">
                    {day.positive > 0 && (
                      <div
                        className="bg-green-500 h-full"
                        style={{ width: `${(day.positive / day.count) * 100}%` }}
                      />
                    )}
                    {day.negative > 0 && (
                      <div
                        className="bg-red-500 h-full"
                        style={{ width: `${(day.negative / day.count) * 100}%` }}
                      />
                    )}
                  </div>
                  <span className="w-12 text-xs text-muted-foreground text-right">
                    {day.count} entries
                  </span>
                </div>
              ))}
            </div>
            
            <div className="flex items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span>Positive</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span>Negative</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="hourly" className="space-y-3">
            <div className="grid grid-cols-12 gap-1">
              {data.hourly.filter((_, i) => i % 2 === 0).map((hour) => (
                <div
                  key={hour.hour}
                  className="aspect-square rounded-sm flex items-center justify-center text-xs"
                  style={{
                    backgroundColor: hour.count > 0 
                      ? `rgba(34, 197, 94, ${0.1 + (hour.avgMood / 5) * 0.8})` 
                      : 'transparent',
                    border: '1px solid rgba(0,0,0,0.1)',
                  }}
                  title={`${hour.label}: ${hour.count} entries, avg mood: ${hour.avgMood.toFixed(1)}`}
                >
                  {hour.count > 0 && hour.count}
                </div>
              ))}
            </div>
            
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>12am</span>
              <span>6am</span>
              <span>12pm</span>
              <span>6pm</span>
              <span>12am</span>
            </div>
          </TabsContent>
        </Tabs>

        {/* Summary */}
        {data.summary && data.summary.bestDay && (
          <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Best Day</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Smile className="h-4 w-4 text-green-500" />
                <span className="font-medium">{data.summary.bestDay.date}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.summary.bestDay.score.toFixed(1)}/5
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Days Tracked</p>
              <p className="font-bold text-lg mt-1">{data.summary.totalDays}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
