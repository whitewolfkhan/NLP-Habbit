import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Habit Stacking API - suggests habits to stack based on patterns

// GET /api/habit-stacks - Get all habit stacks
export async function GET(request: NextRequest) {
  try {
    const stacks = await db.habitStack.findMany({
      where: { isActive: true },
      orderBy: { successRate: 'desc' },
    });

    // Generate suggestions based on patterns
    const suggestions = await generateStackingSuggestions();

    return NextResponse.json({
      success: true,
      data: {
        stacks,
        suggestions,
      },
    });
  } catch (error) {
    console.error('Error fetching habit stacks:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch habit stacks' },
      { status: 500 }
    );
  }
}

// POST /api/habit-stacks - Create a new habit stack
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { triggerHabit, linkedHabit } = body;

    if (!triggerHabit || !linkedHabit) {
      return NextResponse.json(
        { success: false, error: 'triggerHabit and linkedHabit are required' },
        { status: 400 }
      );
    }

    const stack = await db.habitStack.create({
      data: {
        triggerHabit,
        linkedHabit,
        isActive: true,
        successRate: 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: stack,
    });
  } catch (error) {
    console.error('Error creating habit stack:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create habit stack' },
      { status: 500 }
    );
  }
}

// DELETE /api/habit-stacks - Delete a habit stack
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Stack ID is required' },
        { status: 400 }
      );
    }

    await db.habitStack.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Habit stack deactivated',
    });
  } catch (error) {
    console.error('Error deleting habit stack:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete habit stack' },
      { status: 500 }
    );
  }
}

async function generateStackingSuggestions() {
  // Get all entries from the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const entries = await db.habitEntry.findMany({
    where: {
      date: { gte: thirtyDaysAgo },
      type: { contains: 'positive' },
    },
    orderBy: { date: 'asc' },
  });

  if (entries.length < 3) {
    return [];
  }

  // Find patterns: habits that often occur on the same day
  const dayGroups: Record<string, string[]> = {};
  
  entries.forEach((entry) => {
    const dateKey = new Date(entry.date).toISOString().split('T')[0];
    if (!dayGroups[dateKey]) {
      dayGroups[dateKey] = [];
    }
    if (entry.activity) {
      dayGroups[dateKey].push(entry.activity);
    }
  });

  // Count co-occurrences
  const coOccurrences: Record<string, Record<string, number>> = {};
  const activityCounts: Record<string, number> = {};

  Object.values(dayGroups).forEach((activities) => {
    const uniqueActivities = [...new Set(activities)];
    
    uniqueActivities.forEach((activity) => {
      activityCounts[activity] = (activityCounts[activity] || 0) + 1;
    });

    // Count pairs
    for (let i = 0; i < uniqueActivities.length; i++) {
      for (let j = i + 1; j < uniqueActivities.length; j++) {
        const a1 = uniqueActivities[i];
        const a2 = uniqueActivities[j];
        
        if (!coOccurrences[a1]) coOccurrences[a1] = {};
        if (!coOccurrences[a2]) coOccurrences[a2] = {};
        
        coOccurrences[a1][a2] = (coOccurrences[a1][a2] || 0) + 1;
        coOccurrences[a2][a1] = (coOccurrences[a2][a1] || 0) + 1;
      }
    }
  });

  // Generate suggestions based on co-occurrence strength
  const suggestions: Array<{
    triggerHabit: string;
    linkedHabit: string;
    strength: number;
    tip: string;
  }> = [];

  Object.entries(coOccurrences).forEach(([activity, coActs]) => {
    Object.entries(coActs).forEach(([coActivity, count]) => {
      const strength = count / Math.min(activityCounts[activity] || 1, activityCounts[coActivity] || 1);
      
      if (strength >= 0.5 && count >= 2) {
        suggestions.push({
          triggerHabit: activity,
          linkedHabit: coActivity,
          strength: Math.round(strength * 100),
          tip: `After you "${activity}", you often do "${coActivity}". Stack these for better consistency!`,
        });
      }
    });
  });

  // Sort by strength and remove duplicates
  const seenPairs = new Set<string>();
  const uniqueSuggestions = suggestions
    .sort((a, b) => b.strength - a.strength)
    .filter((s) => {
      const pairKey = [s.triggerHabit, s.linkedHabit].sort().join('-');
      if (seenPairs.has(pairKey)) return false;
      seenPairs.add(pairKey);
      return true;
    })
    .slice(0, 5);

  return uniqueSuggestions;
}
