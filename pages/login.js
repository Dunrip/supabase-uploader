/**
 * Login Page
 */
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import LoginForm from '../components/LoginForm';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-dark-accent"></div>
      </div>
    );
  }

  // Don't render login form if user is already authenticated
  if (user) {
    return null;
  }

  const handleSuccess = () => {
    // Use full page reload to reinitialize auth state with new session cookies
    window.location.href = '/';
  };

  return (
    <>
      <Head>
        <title>Sign In - Supabase File Manager</title>
        <meta name="description" content="Sign in to manage your files" />
      </Head>

      <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-4">
        {/* Logo/Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <svg className="w-10 h-10 text-dark-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            <h1 className="text-2xl font-bold text-dark-text">Supabase File Manager</h1>
          </div>
          <p className="text-dark-textMuted">Manage files across your Supabase projects</p>
        </div>

        {/* Login Form */}
        <LoginForm onSuccess={handleSuccess} />

        {/* Footer */}
        <p className="mt-8 text-sm text-dark-textMuted">
          Connect to your own Supabase project after signing in
        </p>
      </div>
    </>
  );
}
