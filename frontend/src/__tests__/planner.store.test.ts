jest.mock('../services/api/planner.service', () => ({
  plannerApi: {
    getTasks: jest.fn(),
    getGoals: jest.fn(),
    getHabits: jest.fn(),
    onTaskCreated: jest.fn(),
    onTaskUpdated: jest.fn(),
    onTaskDeleted: jest.fn(),
    onHabitCreated: jest.fn(),
    onGoalCreated: jest.fn(),
    onGoalUpdated: jest.fn(),
    onHabitCompleted: jest.fn(),
    onGoalProgressChanged: jest.fn(),
    onDeepWorkStarted: jest.fn(),
    onPlanGenerated: jest.fn(),
  },
}));

import { usePlannerStore } from '../stores/planner.store';

describe('usePlannerStore', () => {
  beforeEach(() => {
    localStorage.clear();
    usePlannerStore.getState().resetPlanner();
  });

  afterEach(() => {
    usePlannerStore.getState().resetPlanner();
  });

  it('preserves existing task fields when a realtime update only includes partial data', () => {
    const store = usePlannerStore.getState();

    store.addTask({
      id: 'task-1',
      originalId: 'task-1',
      title: 'Ship dashboard polish',
      description: 'Clean up the dashboard experience',
      status: 'todo',
      priority: 'high',
      category: 'work',
      tags: ['dashboard', 'polish'],
      dueDate: null,
      estimatedDuration: 90,
      actualDuration: 0,
      createdAt: new Date('2026-03-29T10:00:00.000Z'),
      updatedAt: new Date('2026-03-29T10:00:00.000Z'),
      completedAt: null,
    });

    store.addTask({
      id: 'task-1',
      status: 'done',
      updatedAt: new Date('2026-03-29T11:00:00.000Z'),
      completedAt: new Date('2026-03-29T11:00:00.000Z'),
    } as any);

    const task = usePlannerStore.getState().tasks.find((item) => item.id === 'task-1');

    expect(task).toMatchObject({
      id: 'task-1',
      title: 'Ship dashboard polish',
      description: 'Clean up the dashboard experience',
      status: 'done',
      priority: 'high',
      category: 'work',
      estimatedDuration: 90,
      actualDuration: 0,
    });
    expect(task?.tags).toEqual(['dashboard', 'polish']);
    expect(task?.completedAt).toEqual(new Date('2026-03-29T11:00:00.000Z'));
  });
});
