import { Task } from '../types';

interface TaskTemplate {
  title: string;
  taskType: Task['taskType'];
  stageTag: NonNullable<Task['stageTag']>;
  offsetDays: number;
  priority: Task['priority'];
}

const commonTemplates: TaskTemplate[] = [
  { title: 'Confirm client instructions and opening documents', taskType: 'Standard', stageTag: 'PTCM', offsetDays: 2, priority: 'High' },
  { title: 'Review limitation dates and filing deadlines', taskType: 'Review', stageTag: 'PTCM', offsetDays: 3, priority: 'High' },
];

export const TASK_TEMPLATES: Record<string, TaskTemplate[]> = {
  'Civil Litigation': [
    ...commonTemplates,
    { title: 'Prepare initial pleadings checklist', taskType: 'Drafting', stageTag: 'Pleading Stage', offsetDays: 7, priority: 'High' },
    { title: 'Prepare pre-trial case management bundle', taskType: 'Filing', stageTag: 'Trial', offsetDays: 21, priority: 'Medium' },
  ],
  Conveyancing: [
    ...commonTemplates,
    { title: 'Conduct title and bankruptcy searches', taskType: 'Research', stageTag: 'PTCM', offsetDays: 5, priority: 'High' },
    { title: 'Prepare execution and completion documents', taskType: 'Drafting', stageTag: 'Settlement', offsetDays: 14, priority: 'Medium' },
  ],
  Criminal: [
    ...commonTemplates,
    { title: 'Review charge sheet and client instructions', taskType: 'Review', stageTag: 'Pleading Stage', offsetDays: 5, priority: 'High' },
    { title: 'Prepare mitigation or trial strategy', taskType: 'Drafting', stageTag: 'Trial', offsetDays: 14, priority: 'Medium' },
  ],
  Corporate: [
    ...commonTemplates,
    { title: 'Confirm transaction parties and authority documents', taskType: 'Review', stageTag: 'PTCM', offsetDays: 5, priority: 'High' },
    { title: 'Prepare transaction documents for review', taskType: 'Drafting', stageTag: 'Settlement', offsetDays: 14, priority: 'Medium' },
  ],
  Estate: [
    ...commonTemplates,
    { title: 'Collect grant and beneficiary documents', taskType: 'Research', stageTag: 'PTCM', offsetDays: 5, priority: 'High' },
    { title: 'Prepare probate or administration filing', taskType: 'Filing', stageTag: 'Filing & Pleadings', offsetDays: 14, priority: 'Medium' },
  ],
};

export function buildTasksForMatter(practiceArea: string, startDate: string, assignedTo: string): Task[] {
  const templates = TASK_TEMPLATES[practiceArea] || commonTemplates;
  const start = new Date(startDate);
  return templates.map((template, index) => {
    const dueDate = new Date(start.getTime() + template.offsetDays * 86400000).toISOString().slice(0, 10);
    return {
      id: `TASK-TEMPLATE-${Date.now()}-${index}`,
      title: template.title,
      priority: template.priority,
      status: 'Not Started',
      stageTag: template.stageTag,
      dueDate,
      assignedTo,
      taskType: template.taskType,
      description: 'Created from the standard matter intake checklist.',
    };
  });
}
