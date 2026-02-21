import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Create a fresh PrismaClient instance to ensure all models are available
const prisma = new PrismaClient({
  log: ['query'],
});

// Gamification API - badges, points, streaks, and levels

// Points configuration
const POINTS_CONFIG = {
  positiveHabit: 10,
  negativeBehavior: -5, // Still track, but penalize
  streak: 5, // Per day of streak
  goalComplete: 50,
  firstOfDay: 15, // Bonus for being first entry of the day
};

// Badge definitions
const BADGES = [
  { id: 'first-step', name: 'First Step', description: 'Log your first habit', icon: '🎯', requirement: { entries: 1 } },
  { id: 'week-warrior', name: 'Week Warrior', description: '7-day streak', icon: '🔥', requirement: { streak: 7 } },
  { id: 'two-week-champion', name: 'Two Week Champion', description: '14-day streak', icon: '💪', requirement: { streak: 14 } },
  { id: 'month-master', name: 'Month Master', description: '30-day streak', icon: '👑', requirement: { streak: 30 } },
  { id: 'hundred-club', name: '100 Club', description: 'Log 100 habits', icon: '💯', requirement: { entries: 100 } },
  { id: 'goal-crusher', name: 'Goal Crusher', description: 'Complete your first goal', icon: '🏆', requirement: { goalsCompleted: 1 } },
  { id: 'mood-tracker', name: 'Mood Tracker', description: 'Log 10 entries with mood', icon: '😊', requirement: { moodEntries: 10 } },
  { id: 'early-bird', name: 'Early Bird', description: 'Log 5 morning habits (before 8am)', icon: '🌅', requirement: { morningEntries: 5 } },
  { id: 'night-owl', name: 'Night Owl', description: 'Log 5 evening habits (after 9pm)', icon: '🦉', requirement: { eveningEntries: 5 } },
  { id: 'variety-king', name: 'Variety King', description: 'Log 10 different activities', icon: '🎭', requirement: { uniqueActivities: 10 } },
  { id: 'positive-vibes', name: 'Positive Vibes', description: 'Log 20 positive habits', icon: '✨', requirement: { positiveCount: 20 } },
  { id: 'insight-seeker', name: 'Insight Seeker', description: 'View AI insights 10 times', icon: '🔍', requirement: { insightsViewed: 10 } },
  { id: 'streak-saver', name: 'Streak Saver', description: 'Log a habit when streak was at risk', icon: '🛡️', requirement: { streakSaved: 1 } },
  { id: 'triple-threat', name: 'Triple Threat', description: 'Log 3 different categories', icon: '🎪', requirement: { categories: 3 } },
  { id: 'iron-will', name: 'Iron Will', description: 'Maintain 90% positive habits for a week', icon: '🧲', requirement: { positiveRatio: 0.9, days: 7 } },
];

// GET /api/gamification - Get gamification stats
export async function GET(request: NextRequest) {
  try {
    // Get or create user profile
    let profile = await prisma.userProfile.findFirst();
    
    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {},
      });
    }

    // Recalculate stats
    const stats = await recalculateStats(profile.id);
    
    // Check for new badges
    const newBadges = await checkForNewBadges(profile.id, stats);

    return NextResponse.json({
      success: true,
      data: {
        profile: stats,
        badges: newBadges.allBadges,
        newBadges: newBadges.newBadges,
        level: calculateLevel(stats.totalPoints),
        nextLevel: getNextLevelProgress(stats.totalPoints),
      },
    });
  } catch (error) {
    console.error('Error fetching gamification stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

async function recalculateStats(profileId: string) {
  // Get all entries
  const entries = await prisma.habitEntry.findMany({
    orderBy: { date: 'asc' },
  });

  // Calculate totals
  let totalPoints = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  const dates = new Set<string>();
  const activities = new Set<string>();
  const categories = new Set<string>();
  let moodEntries = 0;
  let morningEntries = 0;
  let eveningEntries = 0;
  const goals = await prisma.goal.findMany();

  entries.forEach((entry) => {
    // Calculate points
    if (entry.type?.includes('positive')) {
      totalPoints += POINTS_CONFIG.positiveHabit;
      positiveCount++;
    } else if (entry.type?.includes('negative')) {
      totalPoints += POINTS_CONFIG.negativeBehavior;
      negativeCount++;
    } else {
      totalPoints += 5; // Neutral entry
    }

    // Track unique activities and categories
    if (entry.activity) activities.add(entry.activity);
    if (entry.category) categories.add(entry.category);

    // Track dates
    dates.add(new Date(entry.date).toISOString().split('T')[0]);

    // Track mood entries
    if (entry.mood) moodEntries++;

    // Track time-based entries
    const hour = new Date(entry.date).getHours();
    if (hour < 8) morningEntries++;
    if (hour >= 21) eveningEntries++;
  });

  // Add points for completed goals
  const completedGoals = goals.filter(g => g.currentValue >= g.targetValue);
  totalPoints += completedGoals.length * POINTS_CONFIG.goalComplete;

  // Calculate streak
  const sortedDates = Array.from(dates).sort().reverse();
  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < sortedDates.length; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const checkStr = checkDate.toISOString().split('T')[0];

    if (sortedDates.includes(checkStr)) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Add streak bonus
  totalPoints += currentStreak * POINTS_CONFIG.streak;

  // Update profile
  const updatedProfile = await prisma.userProfile.update({
    where: { id: profileId },
    data: {
      totalPoints,
      currentStreak,
      longestStreak: Math.max(currentStreak, (await prisma.userProfile.findUnique({ where: { id: profileId } }))?.longestStreak || 0),
      lastActivityDate: entries.length > 0 ? entries[entries.length - 1].date : null,
    },
  });

  return {
    ...updatedProfile,
    totalEntries: entries.length,
    positiveCount,
    negativeCount,
    uniqueActivities: activities.size,
    categories: categories.size,
    moodEntries,
    morningEntries,
    eveningEntries,
    goalsCompleted: completedGoals.length,
  };
}

async function checkForNewBadges(profileId: string, stats: any) {
  // Get existing badges
  const existingBadges = await prisma.badge.findMany({
    where: { userId: profileId },
  });
  const existingBadgeIds = existingBadges.map(b => b.name);

  const newBadges: any[] = [];
  const allBadges: any[] = [...existingBadges];

  // Check each badge
  for (const badge of BADGES) {
    if (existingBadgeIds.includes(badge.name)) continue;

    let earned = false;

    if (badge.requirement.entries && stats.totalEntries >= badge.requirement.entries) earned = true;
    if (badge.requirement.streak && stats.currentStreak >= badge.requirement.streak) earned = true;
    if (badge.requirement.goalsCompleted && stats.goalsCompleted >= badge.requirement.goalsCompleted) earned = true;
    if (badge.requirement.moodEntries && stats.moodEntries >= badge.requirement.moodEntries) earned = true;
    if (badge.requirement.morningEntries && stats.morningEntries >= badge.requirement.morningEntries) earned = true;
    if (badge.requirement.eveningEntries && stats.eveningEntries >= badge.requirement.eveningEntries) earned = true;
    if (badge.requirement.uniqueActivities && stats.uniqueActivities >= badge.requirement.uniqueActivities) earned = true;
    if (badge.requirement.positiveCount && stats.positiveCount >= badge.requirement.positiveCount) earned = true;
    if (badge.requirement.categories && stats.categories >= badge.requirement.categories) earned = true;

    if (earned) {
      const newBadge = await prisma.badge.create({
        data: {
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          category: badge.requirement.streak ? 'streak' : 
                    badge.requirement.entries ? 'consistency' : 
                    badge.requirement.goalsCompleted ? 'achievement' : 'special',
          requirement: JSON.stringify(badge.requirement),
          userId: profileId,
        },
      });
      newBadges.push(newBadge);
      allBadges.push(newBadge);
    }
  }

  return { newBadges, allBadges };
}

function calculateLevel(points: number): { level: number; title: string; icon: string } {
  const levels = [
    { min: 0, level: 1, title: 'Beginner', icon: '🌱' },
    { min: 50, level: 2, title: 'Apprentice', icon: '📖' },
    { min: 150, level: 3, title: 'Habit Builder', icon: '🏗️' },
    { min: 300, level: 4, title: 'Consistent', icon: '⚖️' },
    { min: 500, level: 5, title: 'Dedicated', icon: '💎' },
    { min: 800, level: 6, title: 'Habit Master', icon: '🎯' },
    { min: 1200, level: 7, title: 'Champion', icon: '🏆' },
    { min: 1700, level: 8, title: 'Legend', icon: '⭐' },
    { min: 2500, level: 9, title: 'Habit God', icon: '👑' },
    { min: 3500, level: 10, title: 'Transcendent', icon: '🌟' },
  ];

  for (let i = levels.length - 1; i >= 0; i--) {
    if (points >= levels[i].min) {
      return levels[i];
    }
  }
  return levels[0];
}

function getNextLevelProgress(points: number): { current: number; needed: number; progress: number } {
  const levelThresholds = [0, 50, 150, 300, 500, 800, 1200, 1700, 2500, 3500, 5000];
  
  for (let i = 0; i < levelThresholds.length - 1; i++) {
    if (points >= levelThresholds[i] && points < levelThresholds[i + 1]) {
      const current = points - levelThresholds[i];
      const needed = levelThresholds[i + 1] - levelThresholds[i];
      return {
        current,
        needed,
        progress: Math.round((current / needed) * 100),
      };
    }
  }
  
  return { current: points, needed: 100, progress: 100 };
}
