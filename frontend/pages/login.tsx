'use client';

import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import axios from 'axios';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import 'react-toastify/dist/ReactToastify.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        email,
        password,
      });
      localStorage.setItem('token', res.data.token);
      toast.success('Logged in successfully');
      router.push('/dashboard');
    } catch (error) {
      toast.error('Invalid email or password');
    }
  };

  return (
    <>
      <Head>
        <title>Login - Website Link Checker</title>
        <meta name="description" content="Log in to your Website Link Checker account." />
      </Head>

      <Navbar />

      <main className="min-vh-100 d-flex align-items-center justify-content-center bg-light py-5">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-md-6 col-lg-4">
              <div className="card shadow-lg">
                <div className="card-body">
                  <h2 className="text-center text-3xl font-weight-bold text-primary mb-4">
                    Sign in to your account
                  </h2>
                  <p className="text-center text-sm text-muted mb-4">
                    Don’t have an account?{' '}
                    <Link href="/signup" className="text-primary text-decoration-none">
                      Sign up
                    </Link>
                  </p>
                  <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                      <label htmlFor="email" className="form-label">
                        Email address
                      </label>
                      <input
                        id="email"
                        type="email"
                        className="form-control"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="mb-3">
                      <label htmlFor="password" className="form-label">
                        Password
                      </label>
                      <input
                        id="password"
                        type="password"
                        className="form-control"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <div className="d-grid">
                      <button
                        type="submit"
                        className="btn btn-primary btn-block"
                      >
                        Sign in
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
