import { render, screen } from '@testing-library/react';
import App from './App';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';

const SITE_KEY = 'test-key';

test('renders header', () => {
  render(
    <GoogleReCaptchaProvider reCaptchaKey={SITE_KEY}>
      <App />
    </GoogleReCaptchaProvider>
  );
  const heading = screen.getByText(/Ask/i);
  expect(heading).toBeInTheDocument();
});
