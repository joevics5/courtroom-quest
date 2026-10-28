import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CaseThumb from './CaseThumb';

describe('CaseThumb', () => {
  it('draws nothing when the case has no image', () => {
    const { container, rerender } = render(<CaseThumb src={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<CaseThumb src="   " />);
    expect(container).toBeEmptyDOMElement();
    rerender(<CaseThumb />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the thumbnail when there is an image', () => {
    render(<CaseThumb src="https://example.com/case.jpg" />);
    expect(screen.getByTestId('case-thumb')).toHaveAttribute('src', 'https://example.com/case.jpg');
  });

  it('hides itself again if the image fails to load', () => {
    render(<CaseThumb src="https://example.com/broken.jpg" />);
    fireEvent.error(screen.getByTestId('case-thumb'));
    expect(screen.queryByTestId('case-thumb')).toBeNull();
  });
});
