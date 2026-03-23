import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import { ThemeProvider } from './providers';
import { SettingsProvider } from './settings-provider';
import { AppShell } from '@/components/auth/AppShell';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { APP_NAME } from '@/lib/branding';

export const metadata: Metadata = {
  title: `${APP_NAME} -- Command Centre`,
  description: `${APP_NAME} AI Agent Management Dashboard`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <ClerkProvider>
          <ThemeProvider>
            <SettingsProvider>
              <AuthGuard>
                <AppShell session={null}>{children}</AppShell>
              </AuthGuard>
            </SettingsProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
