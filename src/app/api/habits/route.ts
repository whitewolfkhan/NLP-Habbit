import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// Habit API Routes - supports positive habits, negative behaviors, and emotional events

// GET /api/habits - Get all habits with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activity = searchParams.get('activity');
    const category = searchParams.get('category');
    const mood = searchParams.get('mood');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Prisma.HabitEntryWhereInput = {};

    if (activity) {
      where.activity = { contains: activity, mode: 'insensitive' };
    }
    if (category) {
      where.category = category;
    }
    if (mood) {
      where.mood = mood;
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

    const habits = await db.habitEntry.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.habitEntry.count({ where });

    return NextResponse.json({
      success: true,
      data: habits,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + habits.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching habits:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch habits' },
      { status: 500 }
    );
  }
}

// POST /api/habits - Create a new habit entry (already parsed)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      rawText,
      activity,
      type,
      category,
      quantity,
      unit,
      mood,
      sentiment,
      trigger,
      notes,
      tags,
      date,
    } = body;

    if (!rawText || !activity) {
      return NextResponse.json(
        { success: false, error: 'rawText and activity are required' },
        { status: 400 }
      );
    }

    const habit = await db.habitEntry.create({
      data: {
        rawText,
        activity,
        type: type || null,
        category: category || null,
        quantity: quantity ? parseFloat(quantity) : null,
        unit: unit || null,
        mood: mood || null,
        sentiment: sentiment || null,
        trigger: trigger || null,
        notes: notes || null,
        tags: tags ? JSON.stringify(tags) : null,
        date: date ? new Date(date) : new Date(),
      },
    });

    // Update goal progress if applicable
    if (quantity && activity) {
      await updateGoalProgress(activity, parseFloat(quantity));
    }

    return NextResponse.json({
      success: true,
      data: habit,
    });
  } catch (error) {
    console.error('Error creating habit:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create habit entry' },
      { status: 500 }
    );
  }
}

// Helper function to update goal progress
async function updateGoalProgress(activity: string, quantity: number) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    // Find active goals for this activity
    const goals = await db.goal.findMany({
      where: {
        activity: { contains: activity, mode: 'insensitive' },
        isActive: true,
      },
    });

    for (const goal of goals) {
      let startDate: Date;
      let endDate: Date | undefined;

      switch (goal.period) {
        case 'daily':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          endDate = new Date(now.setHours(23, 59, 59, 999));
          break;
        case 'weekly':
          startDate = startOfWeek;
          endDate = new Date(startOfWeek);
          endDate.setDate(endDate.getDate() + 6);
          break;
        case 'monthly':
          startDate = startOfMonth;
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        default:
          continue;
      }

      // Calculate current progress for the period
      const entries = await db.habitEntry.findMany({
        where: {
          activity: { contains: activity, mode: 'insensitive' },
          date: { gte: startDate, lte: endDate || new Date() },
        },
      });

      const totalQuantity = entries.reduce(
        (sum, entry) => sum + (entry.quantity || 0),
        0
      );

      await db.goal.update({
        where: { id: goal.id },
        data: { currentValue: totalQuantity },
      });
    }
  } catch (error) {
    console.error('Error updating goal progress:', error);
  }
}
