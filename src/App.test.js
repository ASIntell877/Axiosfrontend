import { render, screen } from '@testing-library/react';
import App from './App';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import clientConfig from './client_config';

jest.mock('react-markdown', () => ({ children }) => <div>{children}</div>);

const SITE_KEY = 'test-key';

// Checks that my <App /> component renders without crashing

test('renders header', () => {
  render(
    <GoogleReCaptchaProvider reCaptchaKey={SITE_KEY}>
      <App />
    </GoogleReCaptchaProvider>
  );
  const heading = screen.getByText(clientConfig.prairiepastorate.label);
  expect(heading).toBeInTheDocument();
});
