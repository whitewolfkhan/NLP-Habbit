import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// GET /api/habits/export - Export habits to CSV
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activity = searchParams.get('activity');
    const category = searchParams.get('category');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

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

    const entries = await db.habitEntry.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    // Generate CSV
    const headers = [
      'ID',
      'Date',
      'Raw Text',
      'Activity',
      'Category',
      'Quantity',
      'Unit',
      'Mood',
      'Sentiment',
      'Notes',
      'Tags',
    ];

    const rows = entries.map(entry => [
      entry.id,
      entry.date.toISOString(),
      `"${entry.rawText.replace(/"/g, '""')}"`,
      entry.activity,
      entry.category || '',
      entry.quantity?.toString() || '',
      entry.unit || '',
      entry.mood || '',
      entry.sentiment || '',
      entry.notes ? `"${entry.notes.replace(/"/g, '""')}"` : '',
      entry.tags || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    // Return as downloadable file
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="habits-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting habits:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export habits' },
      { status: 500 }
    );
  }
}
