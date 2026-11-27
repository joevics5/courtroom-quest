import { describe, expect, it } from 'vitest';
import { stripStageDirections } from './stripStageDirections';

describe('stripStageDirections', () => {
  it('removes actions in asterisks, brackets and short parentheses', () => {
    expect(stripStageDirections('*shifts in his seat* I was home that night. [pauses] I think around nine.'))
      .toBe('I was home that night. I think around nine.');
    expect(stripStageDirections('(looks away) I never saw the car.')).toBe('I never saw the car.');
    expect(stripStageDirections('I left at six *fidgeting nervously*, then drove home.')).toBe('I left at six, then drove home.');
  });
  it('catches fidgeting, nervous voice and similar asides', () => {
    expect(stripStageDirections('(fidgeting with his hands) I was at work.')).toBe('I was at work.');
    expect(stripStageDirections('Well (voice trembling) I did see him.')).toBe('Well I did see him.');
  });
  it('keeps real speech, including parentheses the witness is actually saying', () => {
    expect(stripStageDirections('I paid in cash (I still have the receipt) on Monday.')).toBe('I paid in cash (I still have the receipt) on Monday.');
    expect(stripStageDirections('It cost 300 (three hundred) dollars.')).toBe('It cost 300 (three hundred) dollars.');
    expect(stripStageDirections('Just answers as they are.')).toBe('Just answers as they are.');
  });
  it('never returns nothing', () => {
    expect(stripStageDirections('*nods*')).toBe('*nods*');
  });

  it('removes Spanish stage directions too', () => {
    expect(stripStageDirections('*suspira* Estaba en casa esa noche. (mira hacia otro lado) Creo que a las nueve.'))
      .toBe('Estaba en casa esa noche. Creo que a las nueve.');
    expect(stripStageDirections('(se encoge de hombros) No lo sé.')).toBe('No lo sé.');
  });

  it('keeps Spanish parentheses that are part of what is said', () => {
    expect(stripStageDirections('Fue el martes (el 14 de mayo) por la tarde.')).toBe('Fue el martes (el 14 de mayo) por la tarde.');
  });
});
