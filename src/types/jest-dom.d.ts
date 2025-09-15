import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveTextContent(text?: string | RegExp): R;
      toBeInTheDocument(): R;
      toHaveClass(className?: string): R;
      toHaveAttribute(attr: string, value?: string): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toHaveValue(value?: string | number): R;
    }
  }
}
