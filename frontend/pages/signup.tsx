import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import axios from 'axios';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signup`, { email, password });
      console.log(res);
      
      localStorage.setItem('token', res.data.token);
      toast.success('Signed up successfully');
      router.push('/dashboard');
    } catch (error) {
      console.log(error);
      toast.error('Signup failed. Email may already exist.');
    }
  };

  return (
    <div>
      <Head>
        <title>Sign Up - Website Link Checker</title>
        <meta name="description" content="Create a new Website Link Checker account." />
      </Head>
      <Navbar />
      <main className="container mx-auto p-4 max-w-md">
        <h1 className="text-2xl font-bold mb-4">Sign Up</h1>
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
            Sign Up
          </button>
          <p className="mt-4 text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600">
              Login
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}