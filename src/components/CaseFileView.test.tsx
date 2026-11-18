// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WitnessSelector from './WitnessSelector';
import EvidenceSelector from './EvidenceSelector';
import type { CaseFileData } from './CaseFileView';
import type { Case, Evidence, Witness } from '../types';

const witness = {
  id: 'w1', case_id: 'c1', name: 'Maya Chen', role: 'Complainant', background: 'Works in accounts.',
  base_testimony: 'My blue lunchbox vanished three Tuesdays in a row.', created_at: '',
  knowledge_scope: { secrets: ['SECRET-DO-NOT-SHOW'] }
} as unknown as Witness;
const calledWitness = { ...witness, id: 'w2', name: 'Gary Whitlock', role: 'Accused', base_testimony: 'It was my own lunchbox.' } as Witness;
const exhibit = { id: 'e1', case_id: 'c1', exhibit_label: 'Exhibit A', title: 'Camera Still', description: 'A still from the breakroom.', evidence_type: 'photographs', content: 'Timestamp 12:04', created_at: '' } as unknown as Evidence;
const usedExhibit = { ...exhibit, id: 'e2', exhibit_label: 'Exhibit B', title: 'Receipt', content: 'Lunchbox $14' } as Evidence;

const caseFile: CaseFileData = {
  caseData: { id: 'c1', title: 'The Office Lunch Thief', versus: 'State vs. Gary Whitlock', description: 'A lunch went missing.', requested_relief: { primary: 'Convict Gary of petty theft' } } as unknown as Case,
  witnesses: [witness, calledWitness],
  evidence: [exhibit, usedExhibit],
  witnessesCalled: ['w2'],
  evidenceSubmitted: ['e2']
};

describe('case details inside the trial pop-ups', () => {
  it('shows a Case details tab with the case, relief and every witness', () => {
    render(<WitnessSelector witnesses={[witness]} witnessesCalled={[]} onSelect={vi.fn()} onSkip={vi.fn()} caseFile={caseFile} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Case details' }));
    expect(screen.getByText('A lunch went missing.')).toBeTruthy();
    expect(screen.getByText('Convict Gary of petty theft')).toBeTruthy();
    expect(screen.getByText('Gary Whitlock')).toBeTruthy();
    expect(screen.getByText(/called/)).toBeTruthy();
  });

  it('the eye on a witness shows their background and written testimony, and Back returns', () => {
    render(<WitnessSelector witnesses={[witness]} witnessesCalled={[]} onSelect={vi.fn()} onSkip={vi.fn()} caseFile={caseFile} />);
    fireEvent.click(screen.getByLabelText('View Maya Chen'));
    expect(screen.getByText('My blue lunchbox vanished three Tuesdays in a row.')).toBeTruthy();
    expect(screen.getByText('Works in accounts.')).toBeTruthy();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('SELECT A WITNESS')).toBeTruthy();
  });

  it('never shows what a witness is hiding', () => {
    render(<WitnessSelector witnesses={[witness]} witnessesCalled={[]} onSelect={vi.fn()} onSkip={vi.fn()} caseFile={caseFile} />);
    fireEvent.click(screen.getByLabelText('View Maya Chen'));
    expect(document.body.textContent).not.toContain('SECRET-DO-NOT-SHOW');
  });

  it('the eye on evidence shows its content, including exhibits already submitted', () => {
    render(<EvidenceSelector evidence={[exhibit]} evidenceSubmitted={[]} onSelect={vi.fn()} onClose={vi.fn()} caseFile={caseFile} />);
    fireEvent.click(screen.getByLabelText('View Camera Still'));
    expect(screen.getByText('Timestamp 12:04')).toBeTruthy();
    fireEvent.click(screen.getByText('Back'));
    fireEvent.click(screen.getByRole('tab', { name: 'Case details' }));
    fireEvent.click(screen.getByLabelText('View Receipt'));
    expect(screen.getByText('Lunchbox $14')).toBeTruthy();
  });

  it('still selects as before, and works without a case file', () => {
    const onSelect = vi.fn();
    render(<WitnessSelector witnesses={[witness]} witnessesCalled={[]} onSelect={onSelect} onSkip={vi.fn()} />);
    expect(screen.queryByRole('tab', { name: 'Case details' })).toBeNull();
    fireEvent.click(screen.getByText('Maya Chen'));
    expect(onSelect).toHaveBeenCalledWith(witness);
  });
});
