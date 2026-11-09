import { render, screen } from '@testing-library/react';
import LiveStatusBar from './LiveStatusBar';

describe('LiveStatusBar', () => {
  it('shows what the other player is doing', () => {
    render(<LiveStatusBar text="Chidi is choosing jurors" />);
    expect(screen.getByRole('status')).toHaveTextContent('Chidi is choosing jurors');
  });
  it('shows nothing when there is nothing to say', () => {
    const { container } = render(<LiveStatusBar text={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
