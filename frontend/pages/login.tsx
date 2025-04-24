import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import axios from 'axios';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, { email, password });
      localStorage.setItem('token', res.data.token);
      toast.success('Logged in successfully');
      router.push('/dashboard');
    } catch (error) {
      toast.error('Invalid credentials');
    }
  };

  return (
    <div>
      <Head>
        <title>Login - Website Link Checker</title>
        <meta name="description" content="Log in to your Website Link Checker account." />
      </Head>
      <Navbar />
      <main className="container mx-auto p-4 max-w-md">
        <h1 className="text-2xl font-bold mb-4">Login</h1>
        <div className="bg-white p-6 rounded shadow">
          <div>
            <label className="block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div className="mt-4">
            <label className="block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <button
            onClick={handleSubmit}
            className="mt-4 w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
          >
            Login
          </button>
          <p className="mt-4 text-center">
            Don’t have an account?{' '}
            <Link href="/signup" className="text-blue-600">
              Sign Up
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}