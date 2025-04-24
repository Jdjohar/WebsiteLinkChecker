import { useState, useEffect } from 'react';
import Head from 'next/head';
import { loadStripe } from '@stripe/stripe-js';
import axios from 'axios';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function Plans() {
  const [plan, setPlan] = useState('free');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/status`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(res => setPlan(res.data.plan)).catch(() => {});
    }
  }, []);

  const handleCheckout = async (plan: string) => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please log in to upgrade');
      return;
    }
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/stripe/checkout`, { plan }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const stripe = await stripePromise;
      await stripe!.redirectToCheckout({ sessionId: res.data.sessionId });
    } catch (error) {
      toast.error('Failed to start checkout');
    }
  };

  return (
    <div>
      <Head>
        <title>Plans - Website Link Checker</title>
        <meta name="description" content="Choose a plan to monitor your websites for broken links." />
      </Head>
      <Navbar />
      <main className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Choose Your Plan</h1>
        <p className="mb-4">Current Plan: {plan.charAt(0).toUpperCase() + plan.slice(1)}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 border rounded shadow">
            <h2 className="text-xl font-bold">Free</h2>
            <p className="my-4">$0/month</p>
            <ul className="list-disc pl-5 mb-4">
              <li>1 domain</li>
              <li>Daily reports</li>
              <li>100 URLs/scan</li>
            </ul>
            <button className="w-full bg-gray-200 p-2 rounded" disabled>Current Plan</button>
          </div>
          <div className="p-6 border rounded shadow">
            <h2 className="text-xl font-bold">Basic</h2>
            <p className="my-4">$15/month</p>
            <ul className="list-disc pl-5 mb-4">
              <li>5 domains</li>
              <li>Daily/weekly reports</li>
              <li>500 URLs/scan</li>
            </ul>
            <button
              onClick={() => handleCheckout('basic')}
              className="mt-4 w-full bg-primary text-white p-2 rounded hover:bg-blue-800"
            >
              Upgrade
            </button>
          </div>
          <div className="p-6 border rounded shadow">
            <h2 className="text-xl font-bold">Advanced</h2>
            <p className="my-4">$25/month</p>
            <ul className="list-disc pl-5 mb-4">
              <li>Unlimited domains</li>
              <li>Daily/weekly/monthly reports</li>
              <li>1000 URLs/scan</li>
            </ul>
            <button
              onClick={() => handleCheckout('advanced')}
              className="mt-4 w-full bg-primary text-white p-2 rounded hover:bg-blue-800"
            >
              Upgrade
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}