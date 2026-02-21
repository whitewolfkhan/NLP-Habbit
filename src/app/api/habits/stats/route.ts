import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// GET /api/habits/stats - Get aggregated statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activity = searchParams.get('activity');
    const category = searchParams.get('category');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const groupBy = searchParams.get('groupBy') || 'day'; // day, week, month

    const where: Prisma.HabitEntryWhereInput = {};

    if (activity) {
      where.activity = { contains: activity, mode: 'insensitive' };
    }
    if (category) {
      where.category = category;
    }
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    // Get all matching entries
    const entries = await db.habitEntry.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    // Calculate summary statistics
    const summary = {
      totalEntries: entries.length,
      totalDistance: 0,
      totalDuration: 0,
      avgQuantity: 0,
      mostFrequentActivity: '',
      mostFrequentCategory: '',
      moodDistribution: {} as Record<string, number>,
      sentimentDistribution: {} as Record<string, number>,
      activityBreakdown: {} as Record<string, number>,
      categoryBreakdown: {} as Record<string, number>,
    };

    const activityCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const quantities: number[] = [];

    entries.forEach(entry => {
      // Count activities
      if (entry.activity) {
        activityCounts[entry.activity] = (activityCounts[entry.activity] || 0) + 1;
      }

      // Count categories
      if (entry.category) {
        categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
      }

      // Track quantities
      if (entry.quantity !== null) {
        quantities.push(entry.quantity);
        
        // Track distance (km, miles)
        if (entry.unit === 'km' || entry.unit === 'miles') {
          summary.totalDistance += entry.quantity;
        }
        // Track duration (minutes, hours)
        if (entry.unit === 'minutes' || entry.unit === 'hours') {
          summary.totalDuration += entry.unit === 'hours' ? entry.quantity * 60 : entry.quantity;
        }
      }

      // Mood distribution
      if (entry.mood) {
        summary.moodDistribution[entry.mood] = (summary.moodDistribution[entry.mood] || 0) + 1;
      }

      // Sentiment distribution
      if (entry.sentiment) {
        summary.sentimentDistribution[entry.sentiment] = (summary.sentimentDistribution[entry.sentiment] || 0) + 1;
      }
    });

    // Calculate averages and most frequent
    if (quantities.length > 0) {
      summary.avgQuantity = quantities.reduce((a, b) => a + b, 0) / quantities.length;
    }

    summary.activityBreakdown = activityCounts;
    summary.categoryBreakdown = categoryCounts;

    // Find most frequent activity and category
    const sortedActivities = Object.entries(activityCounts).sort((a, b) => b[1] - a[1]);
    const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

    if (sortedActivities.length > 0) {
      summary.mostFrequentActivity = sortedActivities[0][0];
    }
    if (sortedCategories.length > 0) {
      summary.mostFrequentCategory = sortedCategories[0][0];
    }

    // Group data by time period for trends
    const trends = groupEntriesByPeriod(entries, groupBy);

    // Calculate streaks
    const streaks = calculateStreaks(entries);

    return NextResponse.json({
      success: true,
      data: {
        summary,
        trends,
        streaks,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}

function groupEntriesByPeriod(entries: any[], groupBy: string) {
  const grouped: Record<string, {
    date: string;
    count: number;
    totalQuantity: number;
    activities: Record<string, number>;
    avgMood: number;
    moodCounts: Record<string, number>;
  }> = {};

  const moodToScore: Record<string, number> = {
    happy: 5, great: 5, amazing: 5, energized: 4, good: 4,
    relaxed: 3, neutral: 3, tired: 2, stressed: 2, sad: 1, bad: 1,
  };

  entries.forEach(entry => {
    let key: string;
    const date = new Date(entry.date);

    switch (groupBy) {
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      default: // day
        key = date.toISOString().split('T')[0];
    }

    if (!grouped[key]) {
      grouped[key] = {
        date: key,
        count: 0,
        totalQuantity: 0,
        activities: {},
        avgMood: 0,
        moodCounts: {},
      };
    }

    grouped[key].count++;
    if (entry.quantity !== null) {
      grouped[key].totalQuantity += entry.quantity;
    }
    if (entry.activity) {
      grouped[key].activities[entry.activity] = (grouped[key].activities[entry.activity] || 0) + 1;
    }
    if (entry.mood) {
      grouped[key].moodCounts[entry.mood] = (grouped[key].moodCounts[entry.mood] || 0) + 1;
      const score = moodToScore[entry.mood] || 3;
      grouped[key].avgMood = (grouped[key].avgMood * (grouped[key].count - 1) + score) / grouped[key].count;
    }
  });

  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
}

function calculateStreaks(entries: any[]) {
  const dates = [...new Set(
    entries.map(e => new Date(e.date).toISOString().split('T')[0])
  )].sort().reverse();

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate current streak (consecutive days from today)
  for (let i = 0; i < dates.length; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const checkStr = checkDate.toISOString().split('T')[0];

    if (dates.includes(checkStr)) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Calculate longest streak
  for (let i = 0; i < dates.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const currDate = new Date(dates[i]);
      const prevDate = new Date(dates[i - 1]);
      const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
  }

  return {
    current: currentStreak,
    longest: longestStreak,
    totalDays: dates.length,
  };
}
