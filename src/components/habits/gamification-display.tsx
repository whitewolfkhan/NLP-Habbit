'use client';

import { useState, useEffect } from 'react';
import { Trophy, Star, Flame, Award, Crown, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GamificationData {
  profile: {
    totalPoints: number;
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: string | null;
  };
  level: {
    level: number;
    title: string;
    icon: string;
  };
  nextLevel: {
    current: number;
    needed: number;
    progress: number;
  };
  badges: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    earnedAt: string;
  }>;
  newBadges: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
  }>;
}

interface GamificationDisplayProps {
  className?: string;
}

export function GamificationDisplay({ className }: GamificationDisplayProps) {
  const [data, setData] = useState<GamificationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchGamification();
  }, []);

  const fetchGamification = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/gamification');
      if (res.ok) {
        const result = await res.json();
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch gamification:', error);
    } finally {
      setIsLoading(false);
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

  if (!data) return null;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-base">Your Progress</CardTitle>
        </div>
        <CardDescription>
          Level {data.level.level}: {data.level.title}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Level Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1">
              <span className="text-lg">{data.level.icon}</span>
              <span className="font-medium">{data.level.title}</span>
            </span>
            <span className="text-muted-foreground">{data.profile.totalPoints} pts</span>
          </div>
          <Progress value={data.nextLevel.progress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {data.nextLevel.current} / {data.nextLevel.needed} points to next level
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <Flame className="h-5 w-5 mx-auto mb-1 text-orange-500" />
            <p className="text-lg font-bold">{data.profile.currentStreak}</p>
            <p className="text-xs text-muted-foreground">Current Streak</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <Star className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className="text-lg font-bold">{data.profile.longestStreak}</p>
            <p className="text-xs text-muted-foreground">Best Streak</p>
          </div>
        </div>

        {/* New Badges Alert */}
        {data.newBadges.length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                New Badge{data.newBadges.length > 1 ? 's' : ''} Earned!
              </span>
            </div>
            {data.newBadges.map((badge, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-lg">{badge.icon}</span>
                <span>{badge.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Badges */}
        {data.badges.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <Crown className="h-4 w-4" />
              Badges ({data.badges.length})
            </h4>
            <ScrollArea className="h-[100px]">
              <div className="flex flex-wrap gap-2">
                {data.badges.map((badge) => (
                  <Badge
                    key={badge.id}
                    variant="outline"
                    className="gap-1 px-2 py-1"
                    title={badge.description}
                  >
                    <span>{badge.icon}</span>
                    <span className="text-xs">{badge.name}</span>
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
