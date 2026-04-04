import type { ImportSource, AssessmentFamily, InternalField } from '@/types/importWizard';

export interface SourcePreset {
  source: ImportSource;
  label: string;
  description: string;
  assessmentFamily: AssessmentFamily;
  suggestedHeaders: Partial<Record<InternalField, string[]>>;
}

const presets: Record<ImportSource, SourcePreset> = {
  acadience: {
    source: 'acadience',
    label: 'Acadience Reading',
    description: 'Import Acadience / CBMReading benchmark data. Default family: Reading.',
    assessmentFamily: 'reading',
    suggestedHeaders: {
      studentIdentifier: ['OEN', 'Student ID'],
      assessmentType: ['Measure', 'Type'],
      score: ['Score', 'Composite'],
      date: ['Date', 'Assessment Date'],
      notes: ['Notes'],
      ref: ['Ref'],
      benchmarkWindow: ['Window', 'Period'],
      status: ['Status', 'Benchmark Status'],
    },
  },
  dibels: {
    source: 'dibels',
    label: 'DIBELS',
    description: 'Import DIBELS literacy screening data. Default family: Reading.',
    assessmentFamily: 'reading',
    suggestedHeaders: {
      studentIdentifier: ['OEN', 'Student ID'],
      assessmentType: ['Measure', 'Subtest'],
      score: ['Score', 'Composite'],
      date: ['Date', 'Assessment Date'],
      status: ['Performance Level', 'Risk'],
    },
  },
  knowledgehook: {
    source: 'knowledgehook',
    label: 'Knowledgehook',
    description: 'Import Knowledgehook math mission / assessment data. Default family: Math.',
    assessmentFamily: 'math',
    suggestedHeaders: {
      studentIdentifier: ['OEN', 'Student ID'],
      assessmentType: ['Assessment', 'Assignment'],
      score: ['Score', 'Percent'],
      date: ['Date', 'Completed On'],
      strand: ['Strand', 'Category'],
      percent: ['Percent', 'Percentage'],
    },
  },
  generic_csv: {
    source: 'generic_csv',
    label: 'Generic CSV',
    description: 'Import from any CSV export. You\'ll map columns manually.',
    assessmentFamily: 'other',
    suggestedHeaders: {},
  },
};

export function getPreset(source: ImportSource): SourcePreset {
  return presets[source];
}

export function getAllPresets(): SourcePreset[] {
  return Object.values(presets);
}
