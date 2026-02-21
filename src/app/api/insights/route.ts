import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';

// GET /api/insights - Get AI-generated insights
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    // Get recent habit entries for analysis
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const entries = await db.habitEntry.findMany({
      where: {
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });

    const goals = await db.goal.findMany({
      where: { isActive: true },
    });

    // Generate insights using AI
    const insights = await generateInsights(entries, goals, type);

    return NextResponse.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
}

async function generateInsights(entries: any[], goals: any[], type: string) {
  // If no entries, return starter insights
  if (entries.length === 0) {
    return [
      {
        type: 'recommendation',
        title: 'Start Your Journey',
        content: 'Log your first habit to begin tracking. Try typing something like "ran 5km this morning" or "read 20 pages before bed".',
        confidence: 1,
        category: 'onboarding',
        icon: '🎯',
      },
      {
        type: 'recommendation',
        title: 'Set Your First Goal',
        content: 'Create a monthly goal to give your habits direction. For example, aim to run 30km this month.',
        confidence: 1,
        category: 'goals',
        icon: '🏆',
      },
    ];
  }

  // Analyze patterns
  const patterns = analyzePatterns(entries);
  
  // Generate AI-powered insights
  const aiInsights = await getAIInsights(patterns, entries, goals);

  // Combine with rule-based insights
  const ruleBasedInsights = generateRuleBasedInsights(patterns, entries, goals);

  return [...aiInsights, ...ruleBasedInsights].slice(0, 10);
}

function analyzePatterns(entries: any[]) {
  const patterns = {
    totalEntries: entries.length,
    positiveCount: 0,
    negativeCount: 0,
    mostFrequentActivity: '',
    mostFrequentTime: '',
    averageMoodScore: 0,
    streakRisk: 0,
    activityFrequency: {} as Record<string, number>,
    moodByDay: {} as Record<string, string[]>,
    moodByTime: {} as Record<string, string[]>,
    categoryBreakdown: {} as Record<string, number>,
    weeklyTrend: [] as number[],
    consecutiveDays: 0,
    skipPatterns: [] as string[],
  };

  let moodSum = 0;
  let moodCount = 0;
  const moodScores: Record<string, number> = {
    happy: 5, great: 5, amazing: 5, proud: 5, accomplished: 5,
    energized: 4, good: 4, motivated: 4,
    calm: 3, relaxed: 3, neutral: 3,
    tired: 2, stressed: 2, anxious: 2,
    sad: 1, guilty: 1, ashamed: 1, bad: 1, angry: 1,
  };

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dates = new Set<string>();

  entries.forEach((entry) => {
    // Count types
    if (entry.type?.includes('positive')) patterns.positiveCount++;
    if (entry.type?.includes('negative')) patterns.negativeCount++;

    // Activity frequency
    if (entry.activity) {
      patterns.activityFrequency[entry.activity] = (patterns.activityFrequency[entry.activity] || 0) + 1;
    }

    // Category breakdown
    if (entry.category) {
      patterns.categoryBreakdown[entry.category] = (patterns.categoryBreakdown[entry.category] || 0) + 1;
    }

    // Mood tracking
    if (entry.mood && moodScores[entry.mood]) {
      moodSum += moodScores[entry.mood];
      moodCount++;
    }

    // Track dates for streak calculation
    const dateStr = new Date(entry.date).toISOString().split('T')[0];
    dates.add(dateStr);

    // Mood by day of week
    const dayName = days[new Date(entry.date).getDay()];
    if (!patterns.moodByDay[dayName]) patterns.moodByDay[dayName] = [];
    if (entry.mood) patterns.moodByDay[dayName].push(entry.mood);

    // Mood by time of day
    const hour = new Date(entry.date).getHours();
    const timeSlot = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    if (!patterns.moodByTime[timeSlot]) patterns.moodByTime[timeSlot] = [];
    if (entry.mood) patterns.moodByTime[timeSlot].push(entry.mood);

    // Track skip/negative patterns
    if (entry.type?.includes('negative') && entry.activity) {
      patterns.skipPatterns.push(entry.activity);
    }
  });

  // Find most frequent activity
  const sortedActivities = Object.entries(patterns.activityFrequency).sort((a, b) => b[1] - a[1]);
  if (sortedActivities.length > 0) {
    patterns.mostFrequentActivity = sortedActivities[0][0];
  }

  // Calculate average mood
  patterns.averageMoodScore = moodCount > 0 ? moodSum / moodCount : 3;

  // Calculate consecutive days
  const sortedDates = Array.from(dates).sort().reverse();
  let consecutive = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < sortedDates.length; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const checkStr = checkDate.toISOString().split('T')[0];
    
    if (sortedDates.includes(checkStr)) {
      consecutive++;
    } else {
      break;
    }
  }
  patterns.consecutiveDays = consecutive;

  // Calculate streak risk (if no activity in last 2 days)
  const lastEntryDate = entries.length > 0 ? new Date(entries[0].date) : null;
  if (lastEntryDate) {
    const daysSinceLastEntry = Math.floor((Date.now() - lastEntryDate.getTime()) / (1000 * 60 * 60 * 24));
    patterns.streakRisk = Math.min(daysSinceLastEntry / 3, 1); // Risk increases over 3 days
  }

  return patterns;
}

async function getAIInsights(patterns: any, entries: any[], goals: any[]) {
  try {
    const zai = await ZAI.create();

    const prompt = `Analyze this habit tracking data and provide 2-3 actionable insights.

Data Summary:
- Total entries: ${patterns.totalEntries}
- Positive habits: ${patterns.positiveCount}
- Negative behaviors: ${patterns.negativeCount}
- Most frequent activity: ${patterns.mostFrequentActivity}
- Average mood score: ${patterns.averageMoodScore.toFixed(1)}/5
- Current streak: ${patterns.consecutiveDays} days
- Streak risk: ${Math.round(patterns.streakRisk * 100)}%
- Activity frequency: ${JSON.stringify(patterns.activityFrequency)}
- Skip patterns: ${patterns.skipPatterns.slice(0, 5).join(', ')}
- Active goals: ${goals.length}

Recent entries (last 5):
${entries.slice(0, 5).map((e: any) => `- ${e.rawText} (${e.type}, mood: ${e.mood || 'neutral'})`).join('\n')}

Provide insights in this JSON format:
[
  {
    "type": "prediction" | "recommendation" | "warning" | "achievement",
    "title": "Short title",
    "content": "Detailed insight with actionable advice",
    "confidence": 0.0-1.0,
    "category": "productivity" | "health" | "mood" | "streak" | "goals",
    "icon": "emoji"
  }
]

Focus on:
1. Predictive insights based on patterns (e.g., likelihood of skipping, mood trends)
2. Personalized recommendations for improvement
3. Warnings about potential streak breaks or negative patterns
4. Celebrations of achievements

Respond with ONLY the JSON array, no other text.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: 'You are an AI habit coach that provides personalized insights based on tracking data.' },
        { role: 'user', content: prompt },
      ],
      thinking: { type: 'disabled' },
    });

    const response = completion.choices[0]?.message?.content;
    
    if (response) {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error('AI insight generation failed:', error);
  }

  return [];
}

function generateRuleBasedInsights(patterns: any, entries: any[], goals: any[]) {
  const insights: any[] = [];

  // Streak warning
  if (patterns.streakRisk > 0.5 && patterns.consecutiveDays > 3) {
    insights.push({
      type: 'warning',
      title: 'Streak at Risk!',
      content: `You haven't logged any activities in a while. Your ${patterns.consecutiveDays}-day streak is in danger! Log a quick habit to keep it going.`,
      confidence: 0.9,
      category: 'streak',
      icon: '⚠️',
    });
  }

  // Negative pattern detection
  if (patterns.negativeCount > patterns.positiveCount * 0.5 && patterns.negativeCount > 3) {
    insights.push({
      type: 'warning',
      title: 'Negative Behavior Pattern Detected',
      content: `You've logged ${patterns.negativeCount} negative behaviors recently. Consider what triggers these patterns and how to redirect them.`,
      confidence: 0.8,
      category: 'mood',
      icon: '🔍',
    });
  }

  // Achievement celebration
  if (patterns.consecutiveDays >= 7) {
    insights.push({
      type: 'achievement',
      title: `${patterns.consecutiveDays} Day Streak! 🎉`,
      content: `Amazing! You've been consistent for ${patterns.consecutiveDays} days. Keep up the great work!`,
      confidence: 1,
      category: 'streak',
      icon: '🔥',
    });
  }

  // Mood insight
  if (patterns.averageMoodScore < 3 && entries.length > 5) {
    insights.push({
      type: 'recommendation',
      title: 'Focus on Well-being',
      content: 'Your recent mood scores have been lower than usual. Consider adding more mood-boosting activities like exercise, meditation, or social time.',
      confidence: 0.7,
      category: 'mood',
      icon: '💭',
    });
  }

  // Activity suggestion
  if (patterns.mostFrequentActivity) {
    insights.push({
      type: 'prediction',
      title: 'Keep the Momentum',
      content: `Based on your patterns, "${patterns.mostFrequentActivity}" is your most consistent habit. You're likely to continue this streak!`,
      confidence: 0.75,
      category: 'productivity',
      icon: '📈',
    });
  }

  // Goal progress reminder
  const incompleteGoals = goals.filter((g: any) => g.currentValue < g.targetValue * 0.5);
  if (incompleteGoals.length > 0) {
    insights.push({
      type: 'recommendation',
      title: 'Goal Check-in',
      content: `You have ${incompleteGoals.length} goal(s) that need attention. Focus on "${incompleteGoals[0].activity}" to make progress!`,
      confidence: 0.8,
      category: 'goals',
      icon: '🎯',
    });
  }

  // Best day/time insight
  const moodByDay = patterns.moodByDay as Record<string, string[]>;
  const bestMoodDay = Object.entries(moodByDay)
    .map(([day, moods]) => ({
      day,
      avgScore: moods.reduce((sum, m) => sum + (m === 'happy' || m === 'great' ? 5 : m === 'good' ? 4 : 3), 0) / moods.length,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)[0];

  if (bestMoodDay && bestMoodDay.avgScore > 3.5) {
    insights.push({
      type: 'insight',
      title: `Best Day: ${bestMoodDay.day}`,
      content: `You tend to have your best moods on ${bestMoodDay.day}s. Consider scheduling important habits or challenging tasks on this day!`,
      confidence: 0.7,
      category: 'productivity',
      icon: '📅',
    });
  }

  return insights;
}
