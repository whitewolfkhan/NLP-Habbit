import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// GET /api/goals - Get all goals
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where: Prisma.GoalWhereInput = {};
    if (activeOnly) {
      where.isActive = true;
    }

    const goals = await db.goal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: goals,
    });
  } catch (error) {
    console.error('Error fetching goals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch goals' },
      { status: 500 }
    );
  }
}

// POST /api/goals - Create a new goal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, activity, targetValue, unit, period, endDate } = body;

    if (!title || !activity || !targetValue || !period) {
      return NextResponse.json(
        { success: false, error: 'title, activity, targetValue, and period are required' },
        { status: 400 }
      );
    }

    const goal = await db.goal.create({
      data: {
        title,
        activity,
        targetValue: parseFloat(targetValue),
        unit: unit || null,
        period,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: goal,
    });
  } catch (error) {
    console.error('Error creating goal:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create goal' },
      { status: 500 }
    );
  }
}

// PUT /api/goals - Update a goal
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Goal ID is required' },
        { status: 400 }
      );
    }

    const updateData: Prisma.GoalUpdateInput = {};
    if (data.title) updateData.title = data.title;
    if (data.activity) updateData.activity = data.activity;
    if (data.targetValue) updateData.targetValue = parseFloat(data.targetValue);
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.period) updateData.period = data.period;
    if (data.currentValue !== undefined) updateData.currentValue = parseFloat(data.currentValue);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.endDate) updateData.endDate = new Date(data.endDate);

    const goal = await db.goal.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: goal,
    });
  } catch (error) {
    console.error('Error updating goal:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update goal' },
      { status: 500 }
    );
  }
}

// DELETE /api/goals - Delete a goal
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Goal ID is required' },
        { status: 400 }
      );
    }

    await db.goal.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Goal deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting goal:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete goal' },
      { status: 500 }
    );
  }
}
