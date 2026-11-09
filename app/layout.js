import './globals.css';
import './theme.css';

export const metadata = {
  metadataBase: new URL('https://contentflow-stg.ast402.my.id'),
  title: {
    default: 'CF Studio — Create More. Do Less. | Autonomous AI Content Engine',
    template: '%s | CF Studio'
  },
  description: 'Enterprise autonomous AI content orchestration engine for strategic multi-channel video production, automated voice cloning, and distributed rendering.',
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'CF Studio — Create More. Do Less.',
    description: 'Enterprise autonomous AI content orchestration engine for strategic video production.',
    url: 'https://contentflow-stg.ast402.my.id',
    siteName: 'CF Studio',
    locale: 'id_ID',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const storedTheme = localStorage.getItem('theme');
                  const theme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'dark';
                  document.documentElement.dataset.theme = theme;
                  document.documentElement.style.colorScheme = theme;
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
