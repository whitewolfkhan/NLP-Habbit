import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, eachWeekOfInterval, subMonths } from 'date-fns';

// GET /api/heatmap - Get sentiment heatmap data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'mood'; // mood, activity, sentiment
    const range = searchParams.get('range') || '30'; // days

    const daysAgo = parseInt(range);
    const startDate = subDays(new Date(), daysAgo);

    const entries = await db.habitEntry.findMany({
      where: {
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    let heatmapData: any;

    switch (type) {
      case 'mood':
        heatmapData = generateMoodHeatmap(entries, daysAgo);
        break;
      case 'activity':
        heatmapData = generateActivityHeatmap(entries, daysAgo);
        break;
      case 'sentiment':
        heatmapData = generateSentimentHeatmap(entries, daysAgo);
        break;
      default:
        heatmapData = generateMoodHeatmap(entries, daysAgo);
    }

    return NextResponse.json({
      success: true,
      data: heatmapData,
    });
  } catch (error) {
    console.error('Error generating heatmap:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate heatmap' },
      { status: 500 }
    );
  }
}

function generateMoodHeatmap(entries: any[], days: number) {
  const moodScores: Record<string, number> = {
    happy: 5, great: 5, amazing: 5, proud: 5, accomplished: 5, energized: 5,
    good: 4, motivated: 4, calm: 4, relaxed: 4,
    neutral: 3, indifferent: 3,
    tired: 2, stressed: 2, anxious: 2, bored: 2,
    sad: 1, guilty: 1, ashamed: 1, bad: 1, angry: 1, frustrated: 1,
  };

  const moodColors: Record<string, string> = {
    happy: '#22c55e', great: '#22c55e', amazing: '#16a34a',
    energized: '#84cc16', motivated: '#84cc16',
    good: '#a3e635', calm: '#14b8a6', relaxed: '#14b8a6',
    neutral: '#6b7280',
    tired: '#f59e0b', stressed: '#f97316', anxious: '#fb923c',
    sad: '#ef4444', guilty: '#dc2626', ashamed: '#b91c1c',
    bad: '#dc2626', angry: '#b91c1c', frustrated: '#ea580c',
  };

  // Create day-by-day data
  const dayData: Record<string, { score: number; count: number; moods: string[]; color: string }> = {};

  entries.forEach((entry) => {
    const dateKey = format(new Date(entry.date), 'yyyy-MM-dd');
    if (!dayData[dateKey]) {
      dayData[dateKey] = { score: 0, count: 0, moods: [], color: '#6b7280' };
    }
    if (entry.mood && moodScores[entry.mood]) {
      dayData[dateKey].score += moodScores[entry.mood];
      dayData[dateKey].count++;
      dayData[dateKey].moods.push(entry.mood);
    }
  });

  // Calculate averages and colors
  const heatmap = Object.entries(dayData).map(([date, data]) => {
    const avgScore = data.count > 0 ? data.score / data.count : 3;
    const dominantMood = data.moods.length > 0 
      ? data.moods.sort((a, b) => 
          data.moods.filter(m => m === b).length - data.moods.filter(m => m === a).length
        )[0]
      : 'neutral';

    return {
      date,
      day: format(new Date(date), 'EEE'),
      dayNum: format(new Date(date), 'd'),
      month: format(new Date(date), 'MMM'),
      score: Math.round(avgScore * 10) / 10,
      count: data.count,
      mood: dominantMood,
      color: moodColors[dominantMood] || '#6b7280',
      intensity: Math.round((avgScore / 5) * 100),
    };
  });

  // Create hourly distribution
  const hourlyDistribution = Array(24).fill(0).map((_, i) => ({
    hour: i,
    label: format(new Date().setHours(i, 0), 'ha'),
    count: 0,
    avgMood: 0,
    moods: [] as string[],
  }));

  entries.forEach((entry) => {
    const hour = new Date(entry.date).getHours();
    hourlyDistribution[hour].count++;
    if (entry.mood) {
      hourlyDistribution[hour].moods.push(entry.mood);
    }
  });

  hourlyDistribution.forEach((h) => {
    if (h.moods.length > 0) {
      const sum = h.moods.reduce((acc, m) => acc + (moodScores[m] || 3), 0);
      h.avgMood = Math.round((sum / h.moods.length) * 10) / 10;
    }
  });

  // Create weekly pattern
  const weeklyPattern = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => ({
    day,
    dayIndex: i,
    count: 0,
    avgMood: 0,
    moods: [] as string[],
    positive: 0,
    negative: 0,
  }));

  entries.forEach((entry) => {
    const dayIndex = new Date(entry.date).getDay();
    weeklyPattern[dayIndex].count++;
    if (entry.mood) weeklyPattern[dayIndex].moods.push(entry.mood);
    if (entry.type?.includes('positive')) weeklyPattern[dayIndex].positive++;
    if (entry.type?.includes('negative')) weeklyPattern[dayIndex].negative++;
  });

  weeklyPattern.forEach((d) => {
    if (d.moods.length > 0) {
      const sum = d.moods.reduce((acc, m) => acc + (moodScores[m] || 3), 0);
      d.avgMood = Math.round((sum / d.moods.length) * 10) / 10;
    }
  });

  return {
    type: 'mood',
    daily: heatmap,
    hourly: hourlyDistribution,
    weekly: weeklyPattern,
    summary: {
      totalDays: heatmap.length,
      averageMood: Math.round((heatmap.reduce((acc, d) => acc + d.score, 0) / heatmap.length) * 10) / 10 || 3,
      bestDay: heatmap.sort((a, b) => b.score - a.score)[0] || null,
      worstDay: heatmap.sort((a, b) => a.score - b.score)[0] || null,
    },
  };
}

function generateActivityHeatmap(entries: any[], days: number) {
  // Group by activity
  const activityData: Record<string, Record<string, number>> = {};

  entries.forEach((entry) => {
    const activity = entry.activity || 'unknown';
    const dateKey = format(new Date(entry.date), 'yyyy-MM-dd');

    if (!activityData[activity]) activityData[activity] = {};
    activityData[activity][dateKey] = (activityData[activity][dateKey] || 0) + 1;
  });

  // Get top activities
  const activityTotals = Object.entries(activityData)
    .map(([activity, dates]) => ({
      activity,
      total: Object.values(dates).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Create heatmap grid
  const dateRange = eachDayOfInterval({
    start: subDays(new Date(), days),
    end: new Date(),
  });

  const heatmap = activityTotals.map(({ activity }) => ({
    activity,
    data: dateRange.map((date) => {
      const dateKey = format(date, 'yyyy-MM-dd');
      return {
        date: dateKey,
        day: format(date, 'EEE'),
        count: activityData[activity]?.[dateKey] || 0,
      };
    }),
  }));

  // Weekly distribution by activity
  const weeklyByActivity: Record<string, number[]> = {};
  entries.forEach((entry) => {
    const activity = entry.activity || 'unknown';
    const dayIndex = new Date(entry.date).getDay();
    if (!weeklyByActivity[activity]) weeklyByActivity[activity] = Array(7).fill(0);
    weeklyByActivity[activity][dayIndex]++;
  });

  return {
    type: 'activity',
    activities: activityTotals.map(a => a.activity),
    heatmap,
    weeklyByActivity,
    summary: {
      totalActivities: Object.keys(activityData).length,
      mostFrequent: activityTotals[0]?.activity || 'none',
      totalEntries: entries.length,
    },
  };
}

function generateSentimentHeatmap(entries: any[], days: number) {
  const sentimentColors = {
    positive: '#22c55e',
    neutral: '#6b7280',
    negative: '#ef4444',
  };

  // Daily sentiment distribution
  const dayData: Record<string, { positive: number; neutral: number; negative: number; total: number }> = {};

  entries.forEach((entry) => {
    const dateKey = format(new Date(entry.date), 'yyyy-MM-dd');
    if (!dayData[dateKey]) {
      dayData[dateKey] = { positive: 0, neutral: 0, negative: 0, total: 0 };
    }
    dayData[dateKey].total++;
    if (entry.sentiment) {
      dayData[dateKey][entry.sentiment as keyof typeof dayData[string]]++;
    }
  });

  const heatmap = Object.entries(dayData).map(([date, data]) => ({
    date,
    day: format(new Date(date), 'EEE'),
    dayNum: format(new Date(date), 'd'),
    positive: data.positive,
    neutral: data.neutral,
    negative: data.negative,
    total: data.total,
    dominantSentiment: data.positive > data.negative && data.positive > data.neutral 
      ? 'positive' 
      : data.negative > data.neutral 
        ? 'negative' 
        : 'neutral',
    positiveRatio: Math.round((data.positive / data.total) * 100),
    color: data.positive > data.negative && data.positive > data.neutral 
      ? sentimentColors.positive 
      : data.negative > data.neutral 
        ? sentimentColors.negative 
        : sentimentColors.neutral,
  }));

  // Trend over time (by week)
  const weeks = eachWeekOfInterval({
    start: subDays(new Date(), days),
    end: new Date(),
  }, { weekStartsOn: 0 });

  const weeklyTrend = weeks.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
    const weekEntries = entries.filter((e) => {
      const date = new Date(e.date);
      return date >= weekStart && date <= weekEnd;
    });

    const positive = weekEntries.filter(e => e.sentiment === 'positive').length;
    const negative = weekEntries.filter(e => e.sentiment === 'negative').length;
    const neutral = weekEntries.filter(e => e.sentiment === 'neutral').length;
    const total = weekEntries.length;

    return {
      weekStart: format(weekStart, 'MMM dd'),
      weekEnd: format(weekEnd, 'MMM dd'),
      positive,
      negative,
      neutral,
      total,
      positiveRatio: total > 0 ? Math.round((positive / total) * 100) : 0,
    };
  });

  return {
    type: 'sentiment',
    daily: heatmap,
    weeklyTrend,
    summary: {
      totalPositive: entries.filter(e => e.sentiment === 'positive').length,
      totalNegative: entries.filter(e => e.sentiment === 'negative').length,
      totalNeutral: entries.filter(e => e.sentiment === 'neutral').length,
      positiveRatio: entries.length > 0 
        ? Math.round((entries.filter(e => e.sentiment === 'positive').length / entries.length) * 100)
        : 0,
    },
  };
}
